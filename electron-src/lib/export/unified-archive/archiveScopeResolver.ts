/**
 * 統合アーカイブ（.sao）に入れる行を決める
 *
 * 規則は docs/unified-archive-design.md §5。既定は関連するデータを全て含め、利用者が外した
 * ものは、それに従う行ごと外す。表どうしのつながりは `archiveTableRegistry.ts` から取る。
 *
 * 手順:
 * 1. 外す行を決める（利用者が外した行と、その行に従う行・その行を必須で参照する行）
 * 2. 選んだ根と共通の実体から始めて、子へ下り（owner）、参照する先へ上る（references）。
 *    上った先に親があれば、その親から根まで上り、根の配下を丸ごと入れる
 * 3. 両側が入った中間テーブルと、選べる項目を足す。2〜3 を増えなくなるまで繰り返す
 * 4. 外せない参照先（成績算出が使う試験・資料など）が外されていたら失敗させる
 */

import type { SqliteDatabase } from "../../prisma/sqliteSchemaUtils"
import {
  ARCHIVE_ROOT_TABLES,
  ARCHIVE_TABLES,
  type ArchiveOptionalItem,
  type ArchiveRootTable,
  type ArchiveTableSpec,
} from "./archiveTableRegistry"

/** 利用者が直接選べる共通の実体 */
export type ArchiveSelectableSharedTable =
  "Student" | "Classroom" | "SubtotalGroup" | "Tag"

/** 採点の範囲。本人分のときは、他の教員の採点・確定・返却版などを外す（docs §5.3） */
export type ArchiveScoringScope =
  { readonly kind: "all" } | { readonly kind: "self"; readonly userId: string }

export interface ArchiveSelection {
  readonly roots: Partial<Record<ArchiveRootTable, readonly string[]>>
  readonly shared?: Partial<
    Record<ArchiveSelectableSharedTable, readonly string[]>
  >
  /** 利用者が外した行（表名 → id） */
  readonly exclusions?: Readonly<Record<string, readonly string[]>>
  /** 既定は全員分 */
  readonly scoring?: ArchiveScoringScope
  /** 受験生・採点・答案を含めるか（今の「雛形」が false）。既定は含める */
  readonly includeAnswers?: boolean
  readonly optionalItems?: readonly ArchiveOptionalItem[]
}

/** 外れた行を指していたため NULL にして書く参照 */
export interface NulledReference {
  readonly table: string
  readonly id: string
  readonly column: string
}

export interface ArchiveScope {
  /** 表名 → 入れる行の id */
  readonly rows: ReadonlyMap<string, ReadonlySet<string>>
  readonly nulledReferences: readonly NulledReference[]
  /** 何も外さなかった場合と比べて、外したことで入らなくなった行の数（表名 → 件数） */
  readonly excludedRowCounts: Readonly<Record<string, number>>
}

/** 外せない参照先が外されていた（docs §5.2） */
export class ArchiveScopeError extends Error {
  constructor(
    message: string,
    readonly violations: readonly {
      readonly table: string
      readonly id: string
      readonly column: string
      readonly target: string
    }[]
  ) {
    super(message)
    this.name = "ArchiveScopeError"
  }
}

/** 範囲の判定に使う列だけを持った行 */
interface ScopeRow {
  readonly id: string
  readonly values: Readonly<Record<string, string | null>>
}

type TableRows = ReadonlyMap<string, ReadonlyMap<string, ScopeRow>>

/** 表 → id の集合（書き換えられる） */
class RowSet {
  private readonly idsByTable = new Map<string, Set<string>>()

  has(table: string, id: string): boolean {
    return this.idsByTable.get(table)?.has(id) ?? false
  }

  /** 新しく入ったときだけ true */
  add(table: string, id: string): boolean {
    let ids = this.idsByTable.get(table)
    if (!ids) {
      ids = new Set()
      this.idsByTable.set(table, ids)
    }
    if (ids.has(id)) return false
    ids.add(id)
    return true
  }

  idsOf(table: string): ReadonlySet<string> {
    return this.idsByTable.get(table) ?? new Set()
  }

  toMap(): ReadonlyMap<string, ReadonlySet<string>> {
    return this.idsByTable
  }
}

const specOf = (table: string): ArchiveTableSpec => {
  const spec = ARCHIVE_TABLES[table]
  if (!spec) throw new Error(`統合アーカイブの登録表に無い表です: ${table}`)
  return spec
}

/** 範囲の判定に要る列（id・外部キー・本人分の判定に使う userId・監査ログの scopeId） */
const columnsOf = (table: string): string[] => {
  const columns = new Set<string>(["id"])
  for (const reference of specOf(table).references) {
    columns.add(reference.column)
  }
  if (table === "AuditLog") columns.add("scopeId")
  return [...columns]
}

const toCellText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null
  return typeof value === "string" ? value : String(value)
}

/** 登録表の全ての表から、範囲の判定に要る列だけを読む */
export function loadScopeRows(db: SqliteDatabase): TableRows {
  const existingTables = new Set(
    db
      .prepare<[], { name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table'"
      )
      .all()
      .map((tableRow) => tableRow.name)
  )
  const tableRows = new Map<string, Map<string, ScopeRow>>()
  for (const table of Object.keys(ARCHIVE_TABLES)) {
    if (!existingTables.has(table)) {
      throw new Error(`DB に表がありません: ${table}`)
    }
    const columns = columnsOf(table)
    const selectList = columns.map((column) => `"${column}"`).join(", ")
    const rowsById = new Map<string, ScopeRow>()
    for (const record of db
      .prepare<[], Record<string, unknown>>(
        `SELECT ${selectList} FROM "${table}"`
      )
      .all()) {
      const id = toCellText(record.id)
      if (id === null) continue
      const values: Record<string, string | null> = {}
      for (const column of columns) values[column] = toCellText(record[column])
      rowsById.set(id, { id, values })
    }
    tableRows.set(table, rowsById)
  }
  return tableRows
}

/** 行を所有する親（owner の列のうち値の入っている最初のもの） */
const ownerOf = (
  table: string,
  row: ScopeRow
): { table: string; id: string } | null => {
  const spec = specOf(table)
  for (const column of spec.owner ?? []) {
    const parentId = row.values[column]
    if (parentId === null || parentId === undefined) continue
    const reference = spec.references.find(
      (candidate) => candidate.column === column
    )
    if (reference) return { table: reference.table, id: parentId }
  }
  return null
}

/** 親 → 所有している子 */
const indexOwnedChildren = (
  tableRows: TableRows
): Map<string, { table: string; id: string }[]> => {
  const children = new Map<string, { table: string; id: string }[]>()
  for (const [table, rowsById] of tableRows) {
    for (const row of rowsById.values()) {
      const owner = ownerOf(table, row)
      if (!owner) continue
      const key = `${owner.table}\u0000${owner.id}`
      const list = children.get(key) ?? []
      list.push({ table, id: row.id })
      children.set(key, list)
    }
  }
  return children
}

/** 参照先 → それを参照している行（外す行の伝播に使う） */
const indexReferrers = (
  tableRows: TableRows
): Map<string, { table: string; id: string; mustFollow: boolean }[]> => {
  const referrers = new Map<
    string,
    { table: string; id: string; mustFollow: boolean }[]
  >()
  for (const [table, rowsById] of tableRows) {
    const spec = specOf(table)
    for (const row of rowsById.values()) {
      for (const reference of spec.references) {
        const targetId = row.values[reference.column]
        if (targetId === null || targetId === undefined) continue
        const key = `${reference.table}\u0000${targetId}`
        const list = referrers.get(key) ?? []
        // 所有の列（任意の列でも）が外れたら従う行も外れる。必須の参照も同じ
        const mustFollow =
          reference.required || (spec.owner ?? []).includes(reference.column)
        list.push({ table, id: row.id, mustFollow })
        referrers.set(key, list)
      }
    }
  }
  return referrers
}

/** 利用者の選択（外した行・本人分・雛形）から、外す行の種を作る */
const exclusionSeeds = (
  tableRows: TableRows,
  selection: ArchiveSelection
): { table: string; id: string }[] => {
  const seeds: { table: string; id: string }[] = []
  for (const [table, ids] of Object.entries(selection.exclusions ?? {})) {
    for (const id of ids) seeds.push({ table, id })
  }
  const rowsOf = (table: string): ScopeRow[] => [
    ...(tableRows.get(table)?.values() ?? []),
  ]
  const scoring = selection.scoring ?? { kind: "all" }
  if (scoring.kind === "self") {
    // 他の教員の採点。確定と返却版は他の教員の採点を前提にするので丸ごと外す（docs §5.3）
    const othersRows = (table: string, userColumn: string) =>
      rowsOf(table)
        .filter((row) => row.values[userColumn] !== scoring.userId)
        .map((row) => ({ table, id: row.id }))
    seeds.push(
      ...othersRows("QuestionScore", "userId"),
      ...othersRows("CompoundAnswerScore", "userId"),
      ...othersRows("UserExam", "userId"),
      ...othersRows("CropRegionAssignment", "userId"),
      ...rowsOf("ScoreDecision").map((row) => ({
        table: "ScoreDecision",
        id: row.id,
      })),
      ...rowsOf("ReturnSnapshot").map((row) => ({
        table: "ReturnSnapshot",
        id: row.id,
      }))
    )
  }
  if (selection.includeAnswers === false) {
    // 受験生を外せば、採点・答案・確定・返却版はそれに従って外れる
    seeds.push(
      ...rowsOf("ExamStudent").map((row) => ({
        table: "ExamStudent",
        id: row.id,
      }))
    )
  }
  return seeds
}

/** 外す行を、それに従う行・それを必須で参照する行まで広げる */
const closeExclusions = (
  tableRows: TableRows,
  selection: ArchiveSelection
): RowSet => {
  const excluded = new RowSet()
  const referrers = indexReferrers(tableRows)
  const pending = exclusionSeeds(tableRows, selection)
  while (pending.length > 0) {
    const next = pending.pop()
    if (!next || !excluded.add(next.table, next.id)) continue
    for (const referrer of referrers.get(`${next.table}\u0000${next.id}`) ??
      []) {
      if (referrer.mustFollow) {
        pending.push({ table: referrer.table, id: referrer.id })
      }
    }
  }
  return excluded
}

interface IncludeResult {
  readonly included: RowSet
  readonly nulledReferences: NulledReference[]
}

/** 選んだものから、関連する行を増えなくなるまで入れる */
const includeRelated = (
  tableRows: TableRows,
  selection: ArchiveSelection,
  excluded: RowSet
): IncludeResult => {
  const included = new RowSet()
  const nulled = new Map<string, NulledReference>()
  const ownedChildren = indexOwnedChildren(tableRows)
  const optionalItems = new Set(selection.optionalItems ?? [])
  const pending: { table: string; id: string }[] = []

  const add = (table: string, id: string): void => {
    if (excluded.has(table, id)) return
    if (!tableRows.get(table)?.has(id)) return
    if (included.add(table, id)) pending.push({ table, id })
  }

  const drain = (): void => {
    while (pending.length > 0) {
      const next = pending.pop()
      if (!next) continue
      const row = tableRows.get(next.table)?.get(next.id)
      if (!row) continue
      // 子へ下る（選べる項目は選んだときだけ）
      for (const child of ownedChildren.get(`${next.table}\u0000${next.id}`) ??
        []) {
        const childSpec = specOf(child.table)
        if (
          childSpec.role === "optional" &&
          (!childSpec.option || !optionalItems.has(childSpec.option))
        ) {
          continue
        }
        add(child.table, child.id)
      }
      // 参照する先へ上る
      for (const reference of specOf(next.table).references) {
        const targetId = row.values[reference.column]
        if (targetId === null || targetId === undefined) continue
        const targetExists = tableRows.get(reference.table)?.has(targetId)
        if (excluded.has(reference.table, targetId) || !targetExists) {
          if (reference.required) {
            throw new Error(
              `${next.table}(${next.id}).${reference.column} が範囲に入らない ${reference.table}(${targetId}) を必須で参照しています`
            )
          }
          nulled.set(`${next.table}\u0000${next.id}\u0000${reference.column}`, {
            table: next.table,
            id: next.id,
            column: reference.column,
          })
          continue
        }
        add(reference.table, targetId)
      }
    }
  }

  for (const table of ARCHIVE_ROOT_TABLES) {
    for (const id of selection.roots[table] ?? []) add(table, id)
  }
  for (const [table, ids] of Object.entries(selection.shared ?? {})) {
    for (const id of ids) add(table, id)
  }
  if (optionalItems.has("appPreference")) {
    for (const id of tableRows.get("AppPreference")?.keys() ?? []) {
      add("AppPreference", id)
    }
  }

  let grew = true
  while (grew) {
    drain()
    grew = false
    // 両側が入った中間テーブル
    for (const [table, rowsById] of tableRows) {
      const spec = specOf(table)
      if (spec.role !== "link") continue
      for (const row of rowsById.values()) {
        if (included.has(table, row.id)) continue
        const bothSides = spec.references.every((reference) => {
          const targetId = row.values[reference.column]
          return (
            targetId !== null &&
            targetId !== undefined &&
            included.has(reference.table, targetId)
          )
        })
        if (bothSides && !excluded.has(table, row.id)) {
          included.add(table, row.id)
          grew = true
        }
      }
    }
  }

  // 監査ログは、範囲（scopeId）が書き出した根を指す行だけ。参照を持たないので最後に足す
  if (optionalItems.has("auditLog")) {
    const rootIds = new Set(
      ARCHIVE_ROOT_TABLES.flatMap((table) => [...included.idsOf(table)])
    )
    for (const row of tableRows.get("AuditLog")?.values() ?? []) {
      const scopeId = row.values.scopeId
      if (scopeId && rootIds.has(scopeId)) included.add("AuditLog", row.id)
    }
  }

  return { included, nulledReferences: [...nulled.values()] }
}

/** 外せない参照先（成績算出が使う試験・資料など）が外されていないかを確かめる */
const assertForcedReferences = (
  tableRows: TableRows,
  included: RowSet,
  excluded: RowSet
): void => {
  const violations: {
    table: string
    id: string
    column: string
    target: string
  }[] = []
  for (const [table, spec] of Object.entries(ARCHIVE_TABLES)) {
    const forcedReferences = spec.references.filter(
      (reference) => reference.forced
    )
    if (forcedReferences.length === 0) continue
    for (const id of included.idsOf(table)) {
      const row = tableRows.get(table)?.get(id)
      if (!row) continue
      for (const reference of forcedReferences) {
        const targetId = row.values[reference.column]
        if (targetId && excluded.has(reference.table, targetId)) {
          violations.push({
            table,
            id,
            column: reference.column,
            target: `${reference.table}(${targetId})`,
          })
        }
      }
    }
  }
  if (violations.length > 0) {
    throw new ArchiveScopeError(
      `成績算出が使うデータは外せません（${violations.length}件）`,
      violations
    )
  }
}

const countExcluded = (
  baseline: RowSet,
  actual: RowSet
): Record<string, number> => {
  const counts: Record<string, number> = {}
  for (const [table, ids] of baseline.toMap()) {
    const missing = [...ids].filter((id) => !actual.has(table, id)).length
    if (missing > 0) counts[table] = missing
  }
  return counts
}

/** 選択から、統合アーカイブに入れる行を決める */
export function resolveArchiveScope(
  tableRows: TableRows,
  selection: ArchiveSelection
): ArchiveScope {
  const excluded = closeExclusions(tableRows, selection)
  const { included, nulledReferences } = includeRelated(
    tableRows,
    selection,
    excluded
  )
  assertForcedReferences(tableRows, included, excluded)

  // 何も外さなかった場合（関連データを全て）と比べ、外したことで入らなくなった行を数える
  const everythingSelection: ArchiveSelection = {
    roots: selection.roots,
    shared: selection.shared,
    optionalItems: selection.optionalItems,
  }
  const baseline = includeRelated(
    tableRows,
    everythingSelection,
    new RowSet()
  ).included

  return {
    rows: included.toMap(),
    nulledReferences,
    excludedRowCounts: countExcluded(baseline, included),
  }
}
