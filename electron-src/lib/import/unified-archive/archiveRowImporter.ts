/**
 * 統合アーカイブ（.sao）の行を、取り込み先の DB へ書く
 *
 * 表ごとの手書きの処理を持たず、スキーマから回す汎用の書き込み（docs/unified-archive-design.md
 * §7.2）。表を外部キーの親が先の順に1表ずつ「決めて、書く」:
 * 決めるのは `archiveTableResolver.ts`（id の写し・照合の決定・3択・一意制約の衝突の解決・
 * 付け替え）、書くのは `archiveTargetRows.ts`（作るは INSERT、置き換えは UPDATE）。
 * 値と時刻の扱いは `importValuePolicy.ts` をそのまま使う（`archiveRowPlanning.ts`）。
 *
 * - 統合は原則 id。id 以外の照合（学籍番号・名前）は付加機能で、利用者の決定（`decisions.matches`）
 *   として受け取る
 * - 一意制約の衝突も3択に従う（§7.3）。上書き・統合は採用する id を選べる（既定は取り込み先の
 *   id、1件ずつ変えられる）。別で追加は既存の id で固定し、アーカイブ側の子を既存の行へ付け替える
 * - アーカイブ側の id を採るときは、取り込み先の行の id と、それを参照する子の外部キーを
 *   UPDATE で付け替える（`archiveIdRenamer.ts`）。削除して作り直さない
 * - 別で追加は、根の子孫の id を振り直す（`renumberSeparateRows`）
 * - 付け替えの途中は親子が一時的にずれるので、外部キーの検査はコミットまで遅らせる
 *   （`PRAGMA defer_foreign_keys = ON`。違反が残ればコミットで SQLite が拒む）
 *
 * 取り込み先への読み書きは `ArchiveTargetConnection` を通す（本番は Prisma の interactive
 * transaction）。解けない衝突は `UnifiedArchiveUnresolvableConflictError` で止め、呼び出し側の
 * トランザクションがロールバックする。確認画面用の試し取り込み（`analyzeUnifiedArchiveImport`）は、
 * 同じ処理を実際に走らせてからロールバックするので、結果は本番と同じ計算になる。
 */

import type { Prisma, PrismaClient } from "@prisma/client"

import type { ImportAction } from "../../../../src/types/importAction.types"
import { createImportValuePolicy } from "../merge/importValuePolicy"
import type { ArchiveIdMap } from "./archiveFileImporter"
import {
  type ArchiveGradeInputChange,
  captureGradeInputChanges,
} from "./archiveGradeInputChanges"
import { filePathsOf, type PlannedRow } from "./archiveRowPlanning"
import { readArchiveRows, renumberSeparateRows } from "./archiveRowReader"
import {
  type ArchiveImportContext,
  resolveArchiveTable,
} from "./archiveTableResolver"
import { insertPlannedRows, updatePlannedRows } from "./archiveTargetRows"
import type {
  ArchiveIdChoice,
  OpenedUnifiedArchive,
  UnifiedArchiveImportDecisions,
} from "./types"

export type UnifiedArchiveTableCounts = {
  created: number
  replaced: number
  kept: number
  /** 照合で取り込まないとした行と、それを必須で参照するため落とした行 */
  skipped: number
}

export interface UnifiedArchiveUniqueConflict {
  readonly table: string
  /** ぶつかった一意索引の列 */
  readonly columns: readonly string[]
  readonly archiveId: string
  readonly existingId: string
  /** アーカイブから読んだままの行（利用者の passcode は含めない） */
  readonly archiveRow: Readonly<Record<string, unknown>>
  /** 衝突を見つけたときの取り込み先の行（利用者の passcode は含めない） */
  readonly existingRow: Readonly<Record<string, unknown>>
  /**
   * 現行化で生まれた行か（`OpenedUnifiedArchive.migratedRowIds`）。古い版で作られたため、
   * 版をまたいで同じものかを id で判断できないことを案内する
   */
  readonly migrated: boolean
  /** 採った id。別で追加は既存に固定（keptExisting） */
  readonly resolution: ArchiveIdChoice | "keptExisting"
}

/** 取り込み先で付け替えた id */
export interface UnifiedArchiveRenamedId {
  readonly table: string
  readonly fromId: string
  readonly toId: string
}

/**
 * 解けない衝突の種類。
 *
 * - multipleExisting: 1行が複数の既存行とぶつかる
 * - sharedExisting: 複数のアーカイブ行が同じ既存行に寄る（id の一致・照合・衝突の解決を含む）
 * - replacementCollides: id が一致した行が値を置き換えると別の既存行とぶつかる（選べる id が無い）
 * - duplicateInArchive: 参照を書き換えた結果、アーカイブの複数の行が同じ一意キーになる
 * - idTaken: 付け替え先のアーカイブの id が、取り込み先に既にある
 * - matchTargetMissing: 照合で選んだ既存の行が、取り込み先に無い
 * - renameInSeparate: 別で追加なのに、既存の行をアーカイブの id へ付け替える照合の決定がある
 */
export type UnifiedArchiveUnresolvableKind =
  | "multipleExisting"
  | "sharedExisting"
  | "replacementCollides"
  | "duplicateInArchive"
  | "idTaken"
  | "matchTargetMissing"
  | "renameInSeparate"

export interface UnifiedArchiveUnresolvableReason {
  readonly kind: UnifiedArchiveUnresolvableKind
  readonly table: string
  /** 関わる一意索引の列（一意キーに関わらない理由では空） */
  readonly columns: readonly string[]
  readonly archiveIds: readonly string[]
  readonly existingIds: readonly string[]
}

export interface UnifiedArchiveImportResult {
  readonly action: ImportAction
  /** 行のある表だけ */
  readonly counts: Readonly<Record<string, UnifiedArchiveTableCounts>>
  readonly uniqueConflicts: readonly UnifiedArchiveUniqueConflict[]
  /** 取り込み先で付け替えた id（付け替えた順） */
  readonly renamedIds: readonly UnifiedArchiveRenamedId[]
  /**
   * アーカイブの id と違う id で書いた・寄せた行（表 → アーカイブの id → 取り込み先の id）。
   * 別で追加の振り直しと、既存の行へ寄せた写し。取り込まなかった行は含めない
   */
  readonly idMap: ArchiveIdMap
  /** 書き込みは止めないが知らせること（埋め込みの id を書き換えられなかった行など） */
  readonly warnings: readonly string[]
  /**
   * 写すファイル（取り込み先の相対パス。写しを当てた後）。`importUnifiedArchiveFiles` は
   * これに載るものだけを写す（docs §7.4）
   */
  readonly filePaths: UnifiedArchiveFilePaths
}

/** 行の取り込みが決めた、写すファイル */
export interface UnifiedArchiveFilePaths {
  /** 作った・置き換えた行が指すファイル。上書きのときは既存のファイルも置き換える */
  readonly written: readonly string[]
  /**
   * 書かずに残した行が指すファイル（取り込み先の行も同じパスを指すもの）。取り込み先に
   * ファイルが無いときだけ写す（行は同じだが画像が欠けている端末を直す）
   */
  readonly kept: readonly string[]
}

/** 解けない一意制約の衝突があるため止めた（呼び出し側のトランザクションがロールバックする） */
export class UnifiedArchiveUnresolvableConflictError extends Error {
  constructor(readonly reasons: readonly UnifiedArchiveUnresolvableReason[]) {
    super(
      `取り込み先との一意制約の衝突を解けません（${reasons.length}件。${[
        ...new Set(reasons.map((reason) => reason.table)),
      ].join(", ")}）`
    )
    this.name = "UnifiedArchiveUnresolvableConflictError"
  }
}

/** 取り込み先への読み書き。Prisma の interactive transaction で実装する */
export interface ArchiveTargetConnection {
  /** 型付けは呼び出し側で狭める（unknown で受けて型ガードで絞る） */
  query<Row>(sql: string, params: readonly unknown[]): Promise<Row[]>
  execute(sql: string, params: readonly unknown[]): Promise<number>
}

/**
 * 1本のトランザクションの中で work を走らせる。work が投げればロールバックして投げ直す。
 * `handle` は実装が渡すトランザクションそのもの（Prisma なら interactive transaction の
 * クライアント）。試し取り込みが、ロールバックする前に include で読むのに使う
 */
export type ArchiveTransactionRunner<Handle = unknown> = <Result>(
  work: (target: ArchiveTargetConnection, handle: Handle) => Promise<Result>
) => Promise<Result>

/** Prisma の interactive transaction を包む */
export function prismaArchiveTarget(
  tx: Prisma.TransactionClient
): ArchiveTargetConnection {
  return {
    query<Row>(sql: string, params: readonly unknown[]) {
      return tx.$queryRawUnsafe<Row[]>(sql, ...params)
    },
    execute(sql: string, params: readonly unknown[]) {
      return tx.$executeRawUnsafe(sql, ...params)
    },
  }
}

/** Prisma の `$transaction` で、取り込みのトランザクションを開く */
export function prismaArchiveTransaction(
  prisma: PrismaClient,
  timeoutMs: number
): ArchiveTransactionRunner<Prisma.TransactionClient> {
  return (work) =>
    prisma.$transaction((tx) => work(prismaArchiveTarget(tx), tx), {
      timeout: timeoutMs,
    })
}

const countRows = (
  plans: readonly PlannedRow[],
  skipped: number
): UnifiedArchiveTableCounts => ({
  created: plans.filter((plan) => plan.kind === "create").length,
  replaced: plans.filter((plan) => plan.kind === "replace").length,
  kept: plans.filter((plan) => plan.kind === "keep").length,
  skipped,
})

/** 取り込まなかった行と、空の表を除いた最終の写し */
const finalIdMap = (context: ArchiveImportContext): ArchiveIdMap =>
  Object.fromEntries(
    Object.entries(context.idMap).flatMap(([table, tableIdMap]) => {
      const dropped = context.droppedIds.get(table)
      const kept = Object.entries(tableIdMap).filter(
        ([archiveId, targetId]) =>
          archiveId !== targetId && !dropped?.has(archiveId)
      )
      return kept.length > 0 ? [[table, Object.fromEntries(kept)]] : []
    })
  )

/**
 * アーカイブの行を取り込み先へ書く。`target` は1本のトランザクションであること。
 * 解けない衝突があれば `UnifiedArchiveUnresolvableConflictError` を投げる（呼び出し側の
 * トランザクションがロールバックする）
 */
export async function importUnifiedArchiveRows(
  target: ArchiveTargetConnection,
  archive: OpenedUnifiedArchive,
  action: ImportAction,
  importedAt: Date,
  decisions: UnifiedArchiveImportDecisions = {}
): Promise<UnifiedArchiveImportResult> {
  const written = await writeUnifiedArchiveRows(
    target,
    archive,
    action,
    importedAt,
    decisions,
    false
  )
  return written.result
}

/**
 * 行を書く本体。`collectGradeInputChanges` のときは、成績算出が読む表へ書いた行の前と後を
 * 控える（試し取り込みだけ。行を引き直すぶん重い）
 */
async function writeUnifiedArchiveRows(
  target: ArchiveTargetConnection,
  archive: OpenedUnifiedArchive,
  action: ImportAction,
  importedAt: Date,
  decisions: UnifiedArchiveImportDecisions,
  collectGradeInputChanges: boolean
): Promise<{
  result: UnifiedArchiveImportResult
  gradeInputChanges: ArchiveGradeInputChange[]
}> {
  const archiveRows = readArchiveRows(archive.databasePath)
  const idMap: Record<string, Record<string, string>> = action === "separate"
    ? renumberSeparateRows(archiveRows.tables)
    : {}
  const context: ArchiveImportContext = {
    target,
    archive,
    action,
    policy: createImportValuePolicy(action, importedAt),
    decisions,
    idMap,
    newIdByOldId: new Map(
      Object.values(idMap).flatMap((tableIdMap) => Object.entries(tableIdMap))
    ),
    droppedIds: new Map(),
    renamedIds: [],
    warnings: [],
  }

  await target.execute("PRAGMA defer_foreign_keys = ON", [])
  const counts: Record<string, UnifiedArchiveTableCounts> = {}
  const writtenFilePaths = new Set<string>()
  const keptFilePaths = new Set<string>()
  const uniqueConflicts: UnifiedArchiveUniqueConflict[] = []
  const gradeInputChanges: ArchiveGradeInputChange[] = []
  for (const tableRows of archiveRows.tables) {
    const resolved = await resolveArchiveTable(context, tableRows)
    if (resolved.reasons.length > 0) {
      throw new UnifiedArchiveUnresolvableConflictError(resolved.reasons)
    }
    const writePlans = async (): Promise<void> => {
      await insertPlannedRows(
        target,
        tableRows.table,
        resolved.plans.filter((plan) => plan.kind === "create")
      )
      await updatePlannedRows(
        target,
        tableRows.table,
        resolved.plans.filter((plan) => plan.kind === "replace")
      )
    }
    if (collectGradeInputChanges) {
      gradeInputChanges.push(
        ...(await captureGradeInputChanges(
          target,
          tableRows.table,
          resolved.plans,
          writePlans
        ))
      )
    } else {
      await writePlans()
    }
    counts[tableRows.table] = countRows(resolved.plans, resolved.skipped)
    uniqueConflicts.push(...resolved.conflicts)
    for (const plan of resolved.plans) {
      if (plan.kind === "keep") continue
      for (const filePath of filePathsOf(tableRows.table, plan.values)) {
        writtenFilePaths.add(filePath)
      }
    }
    for (const filePath of resolved.keptFilePaths) keptFilePaths.add(filePath)
  }
  return {
    result: {
      action,
      counts,
      uniqueConflicts,
      renamedIds: context.renamedIds,
      idMap: finalIdMap(context),
      warnings: context.warnings,
      filePaths: {
        written: [...writtenFilePaths].sort(),
        kept: [...keptFilePaths]
          .filter((filePath) => !writtenFilePaths.has(filePath))
          .sort(),
      },
    },
    gradeInputChanges,
  }
}

/** 試し取り込みの結果 */
export interface UnifiedArchiveAnalysis<Inspection> {
  /** 本番と同じ計算の結果 */
  readonly result: UnifiedArchiveImportResult
  /** 成績算出が読む表へ書いた行の、書く前と書いた後（差分は取らない。docs §7.5） */
  readonly gradeInputChanges: readonly ArchiveGradeInputChange[]
  /** ロールバックする前に、書いた後の取り込み先から `inspect` が読んだもの */
  readonly inspection: Inspection
}

/** 試し取り込みを終えて、トランザクションをロールバックさせるための例外 */
class ArchiveImportAnalysisRollback extends Error {
  constructor() {
    super("統合アーカイブの試し取り込みをロールバックします")
    this.name = "ArchiveImportAnalysisRollback"
  }
}

/**
 * 実際に書いてからロールバックする試し取り込み（確認画面用）。結果は本番と同じ計算。
 * 別で追加の振り直しは呼ぶたびに新しい id になるので、`idMap` の値は目安（実際の id は
 * `importUnifiedArchiveRows` の戻り値のもの）。解けない衝突はそのまま投げる。
 *
 * `inspect` は、書いた後・ロールバックする前に、同じトランザクションの中で取り込み先を読む
 * （成績算出への影響の手がかり。`archiveGradeImpactSource.ts`）
 */
export async function analyzeUnifiedArchiveImport<Handle, Inspection>(
  runInTransaction: ArchiveTransactionRunner<Handle>,
  archive: OpenedUnifiedArchive,
  action: ImportAction,
  decisions: UnifiedArchiveImportDecisions,
  importedAt: Date,
  inspect: (
    handle: Handle,
    gradeInputChanges: readonly ArchiveGradeInputChange[]
  ) => Promise<Inspection>
): Promise<UnifiedArchiveAnalysis<Inspection>> {
  // 投げてロールバックさせるので、結果はトランザクションの外の入れ物で受け取る
  const captured: { analysis?: UnifiedArchiveAnalysis<Inspection> } = {}
  try {
    await runInTransaction(async (target, handle) => {
      const written = await writeUnifiedArchiveRows(
        target,
        archive,
        action,
        importedAt,
        decisions,
        true
      )
      captured.analysis = {
        ...written,
        inspection: await inspect(handle, written.gradeInputChanges),
      }
      throw new ArchiveImportAnalysisRollback()
    })
  } catch (error) {
    if (
      error instanceof ArchiveImportAnalysisRollback &&
      captured.analysis !== undefined
    ) {
      return captured.analysis
    }
    throw error
  }
  throw new Error("統合アーカイブの試し取り込みがロールバックされませんでした")
}
