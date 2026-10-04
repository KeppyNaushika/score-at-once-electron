/**
 * 統合アーカイブ（.sao）の1表分の行を、取り込み先のどの行として書くか決める
 *
 * docs/unified-archive-design.md §7.1 の3（照合）と §7.3（一意制約の衝突）。表は親が先の順に
 * 1表ずつ「決めて、書く」。衝突は親の付け替えの結果として子に連鎖して生まれる（ExamStudent を
 * 既存の id に寄せると、アーカイブの ScoreDecision が既存の ScoreDecision と
 * (cropRegionId, examStudentId) でぶつかる）ので、全体を先に計画せず、**今の取り込み先の状態**
 * （同じトランザクションで既に書いた・付け替えた結果を含む）に対して表ごとに決める。
 *
 * 1表の手順:
 * 1. 前の表までで決まった id の写しで、参照の列・ファイルのパス・埋め込みの id を書き換える。
 *    取り込まない行を必須で参照する行は落とす（任意の参照は NULL）
 * 2. 照合の決定を当てる: same+existing → 既存の id に写す／same+archive → 既存の行をアーカイブの
 *    id へ付け替える／skip → 落とす
 * 3. id で取り込み先を引き、在る行は3択で置き換えるか残すか決める
 * 4. 作る行と置き換える行の一意キーで、取り込み先の別の id の行を引く（衝突）
 * 5. 衝突を解く: 上書き・統合は選んだ id（既定は取り込み先の id）に揃えて、id が一致した行として
 *    3択で扱う。別で追加は既存の行に固定し、アーカイブの行は書かない
 *
 * 解けない衝突（1行が複数の既存行とぶつかる・複数のアーカイブ行が同じ既存行に寄る・id が
 * 一致した行の置き換えが別の既存行とぶつかる、など）は理由に集めて返す。呼び出し側が止める。
 *
 * 見方は保守的: 置き換えで一意キーが変わる行があっても、ぶつかるかは書く前の状態で判断する。
 */

import type { ImportAction } from "../../../../src/types/importAction.types"
import type { ImportValuePolicy } from "../merge/importValuePolicy"
import { renameTargetRow } from "./archiveIdRenamer"
import type {
  ArchiveTargetConnection,
  UnifiedArchiveRenamedId,
  UnifiedArchiveUniqueConflict,
  UnifiedArchiveUnresolvableReason,
} from "./archiveRowImporter"
import {
  keptFilePathsOf,
  planCreatedRow,
  planMatchedRow,
  type PlannedRow,
  remapArchiveRow,
  type RemappedArchiveRow,
  withoutUserSecrets,
  withTargetId,
} from "./archiveRowPlanning"
import type { ArchiveTableRows } from "./archiveRowReader"
import { fetchTargetRows, type TargetRow } from "./archiveTargetRows"
import {
  findCollisions,
  findDuplicatesInArchive,
} from "./archiveUniqueCollisions"
import { listArchiveUniqueIndexes } from "./archiveUniqueIndexes"
import {
  type ArchiveIdChoice,
  archiveRowKey,
  type OpenedUnifiedArchive,
  type UnifiedArchiveImportDecisions,
} from "./types"

/** 1回の取り込みを通して持ち回る状態。表を決めるたびに写しが増える */
export interface ArchiveImportContext {
  readonly target: ArchiveTargetConnection
  readonly archive: OpenedUnifiedArchive
  readonly action: ImportAction
  readonly policy: ImportValuePolicy
  readonly decisions: UnifiedArchiveImportDecisions
  /** 表 → アーカイブの id → 取り込み先で使う id（振り直し・既存へ寄せた写し） */
  readonly idMap: Record<string, Record<string, string>>
  readonly newIdByOldId: Map<string, string>
  readonly droppedIds: Map<string, Set<string>>
  readonly renamedIds: UnifiedArchiveRenamedId[]
  readonly warnings: string[]
}

export interface ResolvedArchiveTable {
  readonly plans: readonly PlannedRow[]
  /** 照合で skip にした行と、取り込まない行を必須で参照するため落とした行の数 */
  readonly skipped: number
  readonly conflicts: readonly UnifiedArchiveUniqueConflict[]
  /**
   * 書かずに残す行（id の一致・既存へ寄せた行）のファイルのパスのうち、取り込み先の行も同じ
   * パスを指すもの。取り込み先にファイルが欠けていれば写す（§7.4）
   */
  readonly keptFilePaths: readonly string[]
  /** 空でなければ、この表は解けない（何も書かずに止める） */
  readonly reasons: readonly UnifiedArchiveUnresolvableReason[]
}

/** アーカイブの行を、取り込み先の既存の行へ寄せる（後続の表の参照にも効く） */
const mapToExisting = (
  context: ArchiveImportContext,
  table: string,
  archiveId: string,
  existingId: string
): void => {
  ;(context.idMap[table] ??= {})[archiveId] = existingId
  context.newIdByOldId.set(archiveId, existingId)
}

const dropRow = (
  context: ArchiveImportContext,
  table: string,
  archiveId: string
): void => {
  let dropped = context.droppedIds.get(table)
  if (!dropped) {
    dropped = new Set()
    context.droppedIds.set(table, dropped)
  }
  dropped.add(archiveId)
}

const renameAndRecord = async (
  context: ArchiveImportContext,
  table: string,
  fromId: string,
  toId: string
): Promise<void> => {
  await renameTargetRow(context.target, table, fromId, toId, context.warnings)
  context.renamedIds.push({ table, fromId, toId })
}

const conflictIdChoiceFor = (
  decisions: UnifiedArchiveImportDecisions,
  table: string,
  archiveId: string
): ArchiveIdChoice =>
  decisions.conflictIdOverrides?.[archiveRowKey(table, archiveId)] ??
  decisions.conflictIdChoice ??
  "existing"

/**
 * 1表分の行を決める。付け替え（取り込み先の id の変更）はここで実行する。
 * 書き込み（作る・置き換える）は呼び出し側が、返した plans で行う
 */
export async function resolveArchiveTable(
  context: ArchiveImportContext,
  tableRows: ArchiveTableRows
): Promise<ResolvedArchiveTable> {
  const { table } = tableRows
  const { target, action, policy, decisions } = context
  const columns = new Set(tableRows.columns)
  const migratedIds = new Set(context.archive.migratedRowIds[table] ?? [])
  const comparedAtFor = (archiveId: string): string | null =>
    migratedIds.has(archiveId) ? context.archive.manifest.exportedAt : null
  const reasons: UnifiedArchiveUnresolvableReason[] = []
  let skipped = 0
  const keptFilePaths: string[] = []
  const recordKeptFiles = (
    plan: PlannedRow,
    values: Readonly<Record<string, unknown>>,
    existingRow: Readonly<Record<string, unknown>>
  ): void => {
    if (plan.kind !== "keep") return
    keptFilePaths.push(...keptFilePathsOf(table, values, existingRow))
  }

  // ── 1. 写しを当てる ────────────────────────────────────────
  const remappedRows: RemappedArchiveRow[] = []
  for (const row of tableRows.rows) {
    const remapped = remapArchiveRow(tableRows, row, context, context.warnings)
    if (remapped === null) {
      dropRow(context, table, row.id)
      skipped++
    } else {
      remappedRows.push(remapped)
    }
  }

  // ── 2. 照合の決定を当てる ──────────────────────────────────
  const candidates: RemappedArchiveRow[] = []
  const matchedToExisting: RemappedArchiveRow[] = []
  const renamesByMatch: { row: RemappedArchiveRow; existingId: string }[] = []
  for (const row of remappedRows) {
    const decision = decisions.matches?.[archiveRowKey(table, row.archiveId)]
    if (!decision || decision.kind === "new") {
      candidates.push(row)
    } else if (decision.kind === "skip") {
      dropRow(context, table, row.archiveId)
      skipped++
    } else if (decision.adoptId === "existing") {
      const mapped = withTargetId(row, decision.existingId)
      matchedToExisting.push(mapped)
      candidates.push(mapped)
    } else if (action === "separate") {
      // 別で追加は既存の行に触らない。id を付け替えることも、既存に触ることになる
      reasons.push({
        kind: "renameInSeparate",
        table,
        columns: [],
        archiveIds: [row.archiveId],
        existingIds: [decision.existingId],
      })
    } else {
      renamesByMatch.push({ row, existingId: decision.existingId })
      candidates.push(row)
    }
  }
  if (matchedToExisting.length > 0 || renamesByMatch.length > 0) {
    const presentRows = await fetchTargetRows(target, table, [
      ...matchedToExisting.map((row) => row.targetId),
      ...renamesByMatch.flatMap(({ row, existingId }) => [
        row.targetId,
        existingId,
      ]),
    ])
    for (const row of matchedToExisting) {
      if (presentRows.has(row.targetId)) continue
      reasons.push({
        kind: "matchTargetMissing",
        table,
        columns: [],
        archiveIds: [row.archiveId],
        existingIds: [row.targetId],
      })
    }
    for (const { row, existingId } of renamesByMatch) {
      if (!presentRows.has(existingId)) {
        reasons.push({
          kind: "matchTargetMissing",
          table,
          columns: [],
          archiveIds: [row.archiveId],
          existingIds: [existingId],
        })
      } else if (presentRows.has(row.targetId)) {
        reasons.push({
          kind: "idTaken",
          table,
          columns: [],
          archiveIds: [row.archiveId],
          existingIds: [existingId],
        })
      }
    }
  }

  // 1つの既存の行に寄るアーカイブの行は1つだけ（id が一致した行・照合・衝突の解決をまとめて数える）
  const claimedBy = new Map<string, string>()
  const claim = (existingId: string, archiveId: string): boolean => {
    const claimant = claimedBy.get(existingId)
    if (claimant === undefined || claimant === archiveId) {
      claimedBy.set(existingId, archiveId)
      return true
    }
    reasons.push({
      kind: "sharedExisting",
      table,
      columns: [],
      archiveIds: [claimant, archiveId],
      existingIds: [existingId],
    })
    return false
  }
  for (const row of matchedToExisting) claim(row.targetId, row.archiveId)
  for (const { row, existingId } of renamesByMatch) {
    claim(existingId, row.archiveId)
  }
  if (reasons.length > 0)
    return {
      plans: [],
      skipped,
      conflicts: [],
      keptFilePaths: [],
      reasons,
    }

  for (const row of matchedToExisting) {
    mapToExisting(context, table, row.archiveId, row.targetId)
  }
  for (const { row, existingId } of renamesByMatch) {
    await renameAndRecord(context, table, existingId, row.targetId)
  }

  // ── 3. id で引き、在る行は3択で決める ─────────────────────
  const existingRows = await fetchTargetRows(
    target,
    table,
    candidates.map((row) => row.targetId)
  )
  const plans: PlannedRow[] = []
  const freshRows: RemappedArchiveRow[] = []
  const replacedRows: RemappedArchiveRow[] = []
  for (const row of candidates) {
    const existingRow = existingRows.get(row.targetId)
    if (!existingRow) {
      freshRows.push(row)
      continue
    }
    if (!claim(row.targetId, row.archiveId)) continue
    const plan = planMatchedRow(
      table,
      columns,
      row,
      existingRow.updatedAt,
      policy,
      comparedAtFor(row.archiveId)
    )
    plans.push(plan)
    recordKeptFiles(plan, row.values, existingRow)
    if (plan.kind === "replace") replacedRows.push(row)
  }

  // ── 4. 一意キーで、取り込み先の別の id の行を引く ──────────
  const uniqueIndexes = await listArchiveUniqueIndexes(
    (sql, params) => target.query<unknown>(sql, params),
    table
  )
  const probedRows = [...freshRows, ...replacedRows]
  const collisions =
    uniqueIndexes.length > 0 && probedRows.length > 0
      ? await findCollisions(target, table, uniqueIndexes, probedRows)
      : new Map<number, Map<string, readonly string[]>>()
  replacedRows.forEach((row, position) => {
    const rowCollisions = collisions.get(freshRows.length + position)
    if (!rowCollisions) return
    reasons.push({
      kind: "replacementCollides",
      table,
      columns: [...rowCollisions.values()][0] ?? [],
      archiveIds: [row.archiveId],
      existingIds: [...rowCollisions.keys()],
    })
  })

  // ── 5. 衝突を解く ──────────────────────────────────────────
  const conflictingRows: {
    row: RemappedArchiveRow
    existingId: string
    columns: readonly string[]
  }[] = []
  freshRows.forEach((row, position) => {
    const rowCollisions = collisions.get(position)
    if (!rowCollisions) {
      plans.push(planCreatedRow(table, columns, row, policy))
      return
    }
    const collidedIds = [...rowCollisions.keys()]
    if (collidedIds.length > 1) {
      reasons.push({
        kind: "multipleExisting",
        table,
        columns: [...rowCollisions.values()][0] ?? [],
        archiveIds: [row.archiveId],
        existingIds: collidedIds,
      })
      return
    }
    conflictingRows.push({
      row,
      existingId: collidedIds[0],
      columns: rowCollisions.get(collidedIds[0]) ?? [],
    })
  })
  const collidedRows: ReadonlyMap<string, TargetRow> =
    conflictingRows.length > 0
      ? await fetchTargetRows(
          target,
          table,
          conflictingRows.map(({ existingId }) => existingId)
        )
      : new Map()
  const conflicts: UnifiedArchiveUniqueConflict[] = []
  const renamesByConflict: { fromId: string; toId: string }[] = []
  for (const { row, existingId, columns: conflictColumns } of conflictingRows) {
    if (!claim(existingId, row.archiveId)) continue
    const existingRow = collidedRows.get(existingId) ?? {}
    const resolution =
      action === "separate"
        ? "keptExisting"
        : conflictIdChoiceFor(decisions, table, row.archiveId)
    conflicts.push({
      table,
      columns: conflictColumns,
      archiveId: row.archiveId,
      existingId,
      archiveRow: withoutUserSecrets(table, row.archiveValues),
      existingRow: withoutUserSecrets(table, existingRow),
      migrated: migratedIds.has(row.archiveId),
      resolution,
    })
    if (resolution === "keptExisting") {
      // 別で追加: 既存の行に固定し、アーカイブの行は書かない。子は既存の行へ付け替わる
      mapToExisting(context, table, row.archiveId, existingId)
      const kept: PlannedRow = {
        kind: "keep",
        archiveId: row.archiveId,
        targetId: existingId,
        values: {},
      }
      plans.push(kept)
      recordKeptFiles(kept, row.values, existingRow)
      continue
    }
    const adopted =
      resolution === "existing" ? withTargetId(row, existingId) : row
    if (resolution === "existing") {
      mapToExisting(context, table, row.archiveId, existingId)
    } else {
      renamesByConflict.push({ fromId: existingId, toId: row.targetId })
    }
    const plan = planMatchedRow(
      table,
      columns,
      adopted,
      existingRow.updatedAt,
      policy,
      comparedAtFor(row.archiveId)
    )
    plans.push(plan)
    recordKeptFiles(plan, adopted.values, existingRow)
  }

  const valuesByArchiveId = new Map(
    [...remappedRows, ...matchedToExisting].map((row) => [
      row.archiveId,
      row.values,
    ])
  )
  reasons.push(
    ...findDuplicatesInArchive(table, uniqueIndexes, plans, valuesByArchiveId)
  )
  if (reasons.length > 0)
    return { plans: [], skipped, conflicts, keptFilePaths: [], reasons }

  for (const rename of renamesByConflict) {
    await renameAndRecord(context, table, rename.fromId, rename.toId)
  }
  return { plans, skipped, conflicts, keptFilePaths, reasons: [] }
}
