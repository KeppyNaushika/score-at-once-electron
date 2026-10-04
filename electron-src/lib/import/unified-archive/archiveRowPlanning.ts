/**
 * 統合アーカイブ（.sao）の1行を、取り込み先へどう書くか（作る・置き換える・残す）と、書く値を決める
 *
 * 値と時刻の扱いは `importValuePolicy.ts` をそのまま使う（上書きは取り込み時刻、統合は LWW と
 * 元の時刻、別で追加は既存に触らない。docs/unified-archive-design.md §7.2）。
 *
 * - 置き換える値に createdAt は含めない（生まれた時刻は取り込みで変わらない）
 * - 利用者の passcode / passcodeType は書かない。アーカイブ側は空にして書き出している（§5.1）。
 *   新しく作る利用者は passcode NULL・passcodeType 'none'
 * - 監査ログは追記だけ。id で在れば何もしない（§5.5）。作るときも時刻はアーカイブのまま
 *   （いつ操作したかが記録の中身なので、上書きでも取り込み時刻にしない）
 * - 現行化で生まれた行（`OpenedUnifiedArchive.migratedRowIds`）は、updatedAt が現行化した時刻で
 *   編集の時刻ではない。統合の LWW では代わりに manifest.exportedAt で比べる（§7.3）。書く
 *   updatedAt はアーカイブの値のまま
 *
 * 参照の列・ファイルのパス・埋め込みの id を、ここまでに決まった id の写しで書き換えるのもここ
 * （`remapArchiveRow`）。
 */

import { ARCHIVE_FILE_COLUMNS } from "../../export/unified-archive/archiveFileCollector"
import { ARCHIVE_TABLES } from "../../export/unified-archive/archiveTableRegistry"
import {
  type ImportValuePolicy,
  replacementUpdatedAt,
} from "../merge/importValuePolicy"
import { embeddedIdColumnsOf, remapEmbeddedIds } from "./archiveEmbeddedIds"
import { remapArchiveFilePath } from "./archiveFileImporter"
import type {
  ArchiveRow,
  ArchiveRowValues,
  ArchiveTableRows,
} from "./archiveRowReader"

type PlannedRowKind = "create" | "replace" | "keep"

export interface PlannedRow {
  readonly kind: PlannedRowKind
  /** アーカイブ側の id（振り直す前） */
  readonly archiveId: string
  /** 取り込み先での id（振り直した id、または寄せた既存の行の id） */
  readonly targetId: string
  /** 書く列と値。作る行は全列、置き換える行は id と SET する列。残す行は空 */
  readonly values: ArchiveRowValues
}

/** 書き換えを当てたアーカイブの行 */
export interface RemappedArchiveRow {
  /** アーカイブ側の id（振り直す前） */
  readonly archiveId: string
  /** アーカイブから読んだままの値 */
  readonly archiveValues: ArchiveRowValues
  /** 取り込み先での id */
  readonly targetId: string
  /** 書き換えた値（id は targetId） */
  readonly values: ArchiveRowValues
}

/** ここまでに決まった id の写し（`remapArchiveRow` が読む） */
interface ArchiveIdMapping {
  /** 表 → アーカイブの id → 取り込み先で使う id */
  readonly idMap: Readonly<Record<string, Readonly<Record<string, string>>>>
  /** idMap を表をまたいで1つにしたもの（id は uuid で、表をまたいで重ならない） */
  readonly newIdByOldId: ReadonlyMap<string, string>
  /** 表 → 取り込まないアーカイブの id（照合で skip にした行と、それを必須で参照する行） */
  readonly droppedIds: ReadonlyMap<string, ReadonlySet<string>>
}

/** 書かない利用者の列（§5.1） */
const USER_SECRET_COLUMNS: ReadonlySet<string> = new Set([
  "passcode",
  "passcodeType",
])
/** 追記だけの表（§5.5） */
const APPEND_ONLY_TABLES: ReadonlySet<string> = new Set(["AuditLog"])

/** ISO 8601 の日時の文字列か（同期のトリガーは時刻列にこれ以外を拒む） */
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

/** 利用者の passcode / passcodeType を除いた行（衝突の案内に返す行） */
export const withoutUserSecrets = (
  table: string,
  values: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> =>
  table === "User"
    ? Object.fromEntries(
        Object.entries(values).filter(
          ([column]) => !USER_SECRET_COLUMNS.has(column)
        )
      )
    : values

/** アーカイブの時刻の値を、importValuePolicy に渡す文字列にする（読めないものは null） */
const archiveTimestampText = (value: unknown): string | null => {
  if (typeof value === "string") return value
  if (typeof value === "number") return new Date(value).toISOString()
  return null
}

/**
 * 決めた時刻を書く文字列にする。アーカイブの値と同じ時刻なら、アーカイブの文字列をそのまま
 * 使う（ISO の書き方の揺れ ─ ミリ秒の有無など ─ で、往復した値が変わらないように）
 */
const timestampTextFor = (decided: Date, archiveValue: unknown): string => {
  const archiveText = archiveTimestampText(archiveValue)
  if (
    archiveText !== null &&
    ISO_DATETIME.test(archiveText) &&
    new Date(archiveText).getTime() === decided.getTime()
  ) {
    return archiveText
  }
  return decided.toISOString()
}

/** 取り込み先の時刻の値（Prisma は Date で返すことも文字列で返すこともある）を Date にする */
const existingTimestamp = (value: unknown): Date => {
  const parsed =
    value instanceof Date
      ? value
      : typeof value === "string" || typeof value === "number"
        ? new Date(value)
        : null
  // 読めない時刻は最も古いものとして扱う（統合ではアーカイブ側が勝つ）
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(0)
}

/** 表の列のうち、ファイルのパスを持つもの */
const fileColumnsOf = (table: string): ReadonlySet<string> =>
  new Set(
    ARCHIVE_FILE_COLUMNS.filter((fileColumn) => fileColumn.table === table).map(
      (fileColumn) => fileColumn.column
    )
  )

/** 行の値のうち、ファイルのパスの列の値（空でない文字列だけ） */
export const filePathsOf = (
  table: string,
  values: Readonly<Record<string, unknown>>
): string[] =>
  [...fileColumnsOf(table)].flatMap((column) => {
    const filePath = values[column]
    return typeof filePath === "string" && filePath !== "" ? [filePath] : []
  })

/**
 * 書かずに残す行のファイルのパス。取り込み先の行が同じパスを指しているものだけ（指していない
 * パスへ写しても、どの行からも参照されない）
 */
export const keptFilePathsOf = (
  table: string,
  values: Readonly<Record<string, unknown>>,
  existingRow: Readonly<Record<string, unknown>>
): string[] =>
  filePathsOf(table, values).filter((filePath) =>
    filePathsOf(table, existingRow).includes(filePath)
  )

/**
 * ここまでに決まった id の写しを、行の id・参照の列・ファイルのパスの列・id を埋め込んだ列
 * （`archiveEmbeddedIds.ts`）へ当てる。
 *
 * - 参照先が取り込まない行なら、必須の参照は行ごと落とす（null を返す）。任意の参照は NULL にする
 * - 埋め込みの列が JSON として読めなければ元の値のまま書き、`warnings` に載せる
 */
export function remapArchiveRow(
  tableRows: ArchiveTableRows,
  row: ArchiveRow,
  mapping: ArchiveIdMapping,
  warnings: string[]
): RemappedArchiveRow | null {
  const spec = ARCHIVE_TABLES[tableRows.table]
  const values: Record<string, unknown> = { ...row.values }
  const targetId = mapping.idMap[tableRows.table]?.[row.id] ?? row.id
  values.id = targetId
  for (const reference of spec.references) {
    const referencedId = values[reference.column]
    if (typeof referencedId !== "string") continue
    if (mapping.droppedIds.get(reference.table)?.has(referencedId)) {
      if (reference.required) return null
      values[reference.column] = null
      continue
    }
    const newId = mapping.idMap[reference.table]?.[referencedId]
    if (newId !== undefined) values[reference.column] = newId
  }
  if (mapping.newIdByOldId.size > 0) {
    for (const column of fileColumnsOf(tableRows.table)) {
      const filePath = values[column]
      if (typeof filePath === "string") {
        values[column] = remapArchiveFilePath(filePath, mapping.newIdByOldId)
      }
    }
    for (const column of embeddedIdColumnsOf(tableRows.table)) {
      const jsonText = values[column]
      if (typeof jsonText !== "string") continue
      const remapped = remapEmbeddedIds(jsonText, mapping.newIdByOldId)
      if (remapped.kind === "ok") {
        values[column] = remapped.text
      } else {
        warnings.push(
          `${tableRows.table}（${row.id}）の ${column} を JSON として読めないため、中の id を書き換えずに書きました`
        )
      }
    }
  }
  return { archiveId: row.id, archiveValues: row.values, targetId, values }
}

/** 行を、取り込み先の別の id の行として扱う形にする（値の id も変える） */
export const withTargetId = (
  row: RemappedArchiveRow,
  targetId: string
): RemappedArchiveRow => ({
  ...row,
  targetId,
  values: { ...row.values, id: targetId },
})

/** 新しく作る行（時刻は createdTimestamps、利用者の passcode は空） */
export function planCreatedRow(
  table: string,
  columns: ReadonlySet<string>,
  row: RemappedArchiveRow,
  policy: ImportValuePolicy
): PlannedRow {
  const { values } = row
  const created: Record<string, unknown> = { ...values }
  if (!APPEND_ONLY_TABLES.has(table)) {
    const timestamps = policy.createdTimestamps({
      createdAt: archiveTimestampText(values.createdAt),
      updatedAt: archiveTimestampText(values.updatedAt),
    })
    if (columns.has("createdAt")) {
      created.createdAt = timestampTextFor(
        timestamps.createdAt,
        values.createdAt
      )
    }
    if (columns.has("updatedAt")) {
      created.updatedAt = timestampTextFor(
        timestamps.updatedAt,
        values.updatedAt
      )
    }
  }
  if (table === "User") {
    created.passcode = null
    created.passcodeType = "none"
  }
  return {
    kind: "create",
    archiveId: row.archiveId,
    targetId: row.targetId,
    values: created,
  }
}

/** 置き換える行の値（id と、SET する列。createdAt と利用者の passcode は含めない） */
const replacedRowValues = (
  table: string,
  values: ArchiveRowValues,
  updatedAtText: string | null
): ArchiveRowValues => {
  const replaced: Record<string, unknown> = {}
  for (const [column, value] of Object.entries(values)) {
    if (column === "createdAt") continue
    if (table === "User" && USER_SECRET_COLUMNS.has(column)) continue
    replaced[column] = value
  }
  if (updatedAtText !== null) replaced.updatedAt = updatedAtText
  return replaced
}

/**
 * 置き換えるなら書く updatedAt、置き換えないなら null。
 * `comparedAtText` があれば（現行化で生まれた行）、比べる時刻はそれにし、書く時刻は
 * アーカイブの updatedAt から決める
 */
const decideReplacedAt = (
  policy: ImportValuePolicy,
  archiveUpdatedAt: unknown,
  existingUpdatedAt: unknown,
  comparedAtText: string | null
): Date | null => {
  const archiveText = archiveTimestampText(archiveUpdatedAt)
  const existing = existingTimestamp(existingUpdatedAt)
  if (comparedAtText === null) {
    return replacementUpdatedAt(policy, archiveText, existing)
  }
  if (!replacementUpdatedAt(policy, comparedAtText, existing)) return null
  const archiveDate = archiveText === null ? null : new Date(archiveText)
  return policy.replacedUpdatedAt(
    archiveDate && !Number.isNaN(archiveDate.getTime())
      ? archiveDate
      : policy.importedAt
  )
}

/**
 * 取り込み先に同じ id の行がある行を、3択に従って置き換えるか残すか決める。
 * `existingUpdatedAt` は取り込み先の行の updatedAt（列が無ければ何でもよい）
 */
export function planMatchedRow(
  table: string,
  columns: ReadonlySet<string>,
  row: RemappedArchiveRow,
  existingUpdatedAt: unknown,
  policy: ImportValuePolicy,
  comparedAtText: string | null
): PlannedRow {
  const { archiveId, targetId, values } = row
  const keep: PlannedRow = { kind: "keep", archiveId, targetId, values: {} }
  if (APPEND_ONLY_TABLES.has(table)) return keep
  if (!columns.has("updatedAt")) {
    // 更新時刻の無い表は LWW で比べられない。上書きだけが置き換える（今の schema には無い）
    return policy.action === "overwrite"
      ? {
          kind: "replace",
          archiveId,
          targetId,
          values: replacedRowValues(table, values, null),
        }
      : keep
  }
  const replacedAt = decideReplacedAt(
    policy,
    values.updatedAt,
    existingUpdatedAt,
    comparedAtText
  )
  if (!replacedAt) return keep
  return {
    kind: "replace",
    archiveId,
    targetId,
    values: replacedRowValues(
      table,
      values,
      timestampTextFor(replacedAt, values.updatedAt)
    ),
  }
}
