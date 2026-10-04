/**
 * 統合アーカイブ（.sao）の取り込みで、id で一致しなかった共通の実体（生徒・学級・
 * 小計グループ・利用者）に、人が打つ値で既存の行を候補として当てる
 *
 * docs/unified-archive-design.md §7.1 の3（紐づけ）。統合は原則 id で、ここは付加機能。
 * 照合の規則は今の取り込みの matcher（electron-src/lib/import/merge/matchers/）と同じで、
 * 表ごとの宣言（`ARCHIVE_MATCH_KEYS`）に移しただけ。規則を変えるときは両方を見ること。
 *
 * - 鍵は優先順に試し、最初に当たった鍵の候補を全部返す。候補の並びは humanKeyMatching の
 *   決まり（いちばん古い順）で、先頭が既定の結び付け先になる。件数は配列の長さで分かる
 * - 当たらない行も候補なしで返す（画面で「新規 / 取り込まない」を選べるように）
 * - 行は加工せずに返す（利用者の passcode / passcodeType だけは除く。§5.1）。
 *   「学籍番号が一致」のような文言は renderer が `matchedBy` から作る
 */

import Database from "better-sqlite3"

import { groupByHumanKey } from "../humanKeyMatching"
import type { ArchiveTargetConnection } from "./archiveRowImporter"
import type { ArchiveMatchDecision, OpenedUnifiedArchive } from "./types"
import { archiveRowKey } from "./types"

export type ArchiveMatchTable =
  "Student" | "Classroom" | "SubtotalGroup" | "User"

export interface ArchiveMatchKey {
  /** 鍵の識別子（renderer が文言に写す） */
  readonly key: string
  /** 鍵を成す列。全ての列の値が一致したら当たり */
  readonly columns: readonly string[]
}

/**
 * 表ごとの照合の鍵（優先順）。今の matcher の規則と同じ:
 * - 生徒: 学籍番号 → 姓名（studentMatcher の existingByStudentNumber / existingByName）
 * - 学級: 学級名（classroomMatcher の existingByName）
 * - 小計グループ: グループ名（subtotalGroupMatcher の existingByName）
 * - 利用者: 利用者名（userMatcher の existingByUsername）
 */
export const ARCHIVE_MATCH_KEYS: Readonly<
  Record<ArchiveMatchTable, readonly ArchiveMatchKey[]>
> = {
  Student: [
    { key: "studentNumber", columns: ["studentNumber"] },
    { key: "name", columns: ["lastName", "firstName"] },
  ],
  Classroom: [{ key: "name", columns: ["name"] }],
  SubtotalGroup: [{ key: "name", columns: ["name"] }],
  User: [{ key: "username", columns: ["username"] }],
}

/**
 * 既定で「同じもの」に結ぶ鍵。今の取り込み画面の既定の紐づけ方法
 * （src/hooks/import/constants.ts の idIntegrationConfig）と同じにする。
 * 生徒の既定は「学籍番号で紐づける」で、姓名だけで当たった生徒は既定では新しく作る
 * （studentProcessor は by_student_number のとき byName の行に既定の決定を当てない）
 */
const SUGGESTED_MATCH_KEY: Readonly<Record<ArchiveMatchTable, string>> = {
  Student: "studentNumber",
  Classroom: "name",
  SubtotalGroup: "name",
  User: "username",
}

const ARCHIVE_MATCH_TABLES: readonly ArchiveMatchTable[] = [
  "Student",
  "Classroom",
  "SubtotalGroup",
  "User",
]

/** 返さない利用者の列（§5.1） */
const USER_SECRET_COLUMNS: ReadonlySet<string> = new Set([
  "passcode",
  "passcodeType",
])

/** 生の1行（列名 → SQLite の値） */
type MatchRowValues = Readonly<Record<string, unknown>>

export interface ArchiveMatchCandidateRow {
  readonly existingId: string
  readonly existingRow: MatchRowValues
}

export interface ArchiveMatchCandidate {
  readonly table: ArchiveMatchTable
  readonly archiveId: string
  readonly archiveRow: MatchRowValues
  /** 当たった鍵の識別子。どの鍵でも当たらなければ null */
  readonly matchedBy: string | null
  /** いちばん古い順。当たらなければ空 */
  readonly candidates: readonly ArchiveMatchCandidateRow[]
}

/** 照合に使う既存の行。groupByHumanKey が要る形（id と Date の createdAt）に揃える */
interface ExistingMatchRow {
  readonly id: string
  readonly createdAt: Date
  readonly values: MatchRowValues
}

const quote = (identifier: string): string =>
  `"${identifier.replaceAll('"', '""')}"`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const withoutSecrets = (
  table: ArchiveMatchTable,
  row: Record<string, unknown>
): MatchRowValues =>
  table === "User"
    ? Object.fromEntries(
        Object.entries(row).filter(
          ([column]) => !USER_SECRET_COLUMNS.has(column)
        )
      )
    : row

/** 鍵の1列の値を文字列にする（文字列でも数でもなければ空） */
const keyPartOf = (columnValue: unknown): string => {
  if (typeof columnValue === "string") return columnValue
  if (typeof columnValue === "number" || typeof columnValue === "bigint") {
    return String(columnValue)
  }
  return ""
}

/** 行の鍵の値。全ての列が空（null・空文字）なら null（照合しない） */
const humanKeyOf = (
  row: MatchRowValues,
  columns: readonly string[]
): string | null => {
  const keyParts = columns.map((column) => keyPartOf(row[column]))
  return keyParts.every((keyPart) => keyPart === "")
    ? null
    : JSON.stringify(keyParts)
}

/** 取り込み先の時刻の値（Date のことも文字列のこともある）を Date にする */
const createdAtOf = (columnValue: unknown): Date => {
  const parsed =
    columnValue instanceof Date
      ? columnValue
      : typeof columnValue === "string" || typeof columnValue === "number"
        ? new Date(columnValue)
        : null
  // 読めない時刻は最も古いものとして扱う（並びは id で決まる）
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(0)
}

/** archive.db から照合する表の行を読む（表が無ければ空） */
const readArchiveMatchRows = (
  databasePath: string
): Map<ArchiveMatchTable, Record<string, unknown>[]> => {
  const archiveDatabase = new Database(databasePath, {
    readonly: true,
    fileMustExist: true,
  })
  try {
    const rowsByTable = new Map<ArchiveMatchTable, Record<string, unknown>[]>()
    for (const table of ARCHIVE_MATCH_TABLES) {
      const tableExists = archiveDatabase
        .prepare<[string], { name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?"
        )
        .get(table)
      if (!tableExists) continue
      rowsByTable.set(
        table,
        archiveDatabase
          .prepare<[], Record<string, unknown>>(
            `SELECT * FROM ${quote(table)} ORDER BY id`
          )
          .all()
      )
    }
    return rowsByTable
  } finally {
    archiveDatabase.close()
  }
}

const readExistingMatchRows = async (
  target: ArchiveTargetConnection,
  table: ArchiveMatchTable
): Promise<ExistingMatchRow[]> => {
  const existingRows = await target.query<unknown>(
    `SELECT * FROM ${quote(table)}`,
    []
  )
  return existingRows.flatMap((existingRow): ExistingMatchRow[] =>
    isRecord(existingRow) && typeof existingRow.id === "string"
      ? [
          {
            id: existingRow.id,
            createdAt: createdAtOf(existingRow.createdAt),
            values: withoutSecrets(table, existingRow),
          },
        ]
      : []
  )
}

const findTableCandidates = async (
  target: ArchiveTargetConnection,
  table: ArchiveMatchTable,
  archiveRows: readonly Record<string, unknown>[]
): Promise<ArchiveMatchCandidate[]> => {
  const existingRows = await readExistingMatchRows(target, table)
  const existingIds = new Set(existingRows.map((existingRow) => existingRow.id))
  const matchKeys = ARCHIVE_MATCH_KEYS[table]
  // 鍵の値が空の既存の行は "" にまとまる。鍵の値は JSON の配列なので "" で引かれることはない
  const existingByKey = new Map(
    matchKeys.map((matchKey) => [
      matchKey.key,
      groupByHumanKey(
        existingRows,
        (existingRow) => humanKeyOf(existingRow.values, matchKey.columns) ?? ""
      ),
    ])
  )

  return archiveRows.flatMap((archiveRow): ArchiveMatchCandidate[] => {
    const archiveId = archiveRow.id
    // id で一致する行は照合しない（id で統合する）
    if (typeof archiveId !== "string" || existingIds.has(archiveId)) return []
    const base = {
      table,
      archiveId,
      archiveRow: withoutSecrets(table, archiveRow),
    }
    for (const matchKey of matchKeys) {
      const archiveKey = humanKeyOf(archiveRow, matchKey.columns)
      if (archiveKey === null) continue
      const matchedRows = existingByKey.get(matchKey.key)?.get(archiveKey) ?? []
      if (matchedRows.length === 0) continue
      return [
        {
          ...base,
          matchedBy: matchKey.key,
          candidates: matchedRows.map((matchedRow) => ({
            existingId: matchedRow.id,
            existingRow: matchedRow.values,
          })),
        },
      ]
    }
    return [{ ...base, matchedBy: null, candidates: [] }]
  })
}

/**
 * 生徒・学級・小計グループ・利用者のうち、取り込み先に同じ id が無いアーカイブの行に、
 * 照合の候補を当てる。並びは表（生徒・学級・小計グループ・利用者）→ アーカイブの id 順
 */
export async function findArchiveMatchCandidates(
  target: ArchiveTargetConnection,
  archive: OpenedUnifiedArchive
): Promise<ArchiveMatchCandidate[]> {
  const archiveRowsByTable = readArchiveMatchRows(archive.databasePath)
  const matchCandidates: ArchiveMatchCandidate[] = []
  for (const table of ARCHIVE_MATCH_TABLES) {
    const archiveRows = archiveRowsByTable.get(table) ?? []
    if (archiveRows.length === 0) continue
    matchCandidates.push(
      ...(await findTableCandidates(target, table, archiveRows))
    )
  }
  return matchCandidates
}

/**
 * 画面の初期値。既定の鍵で当たった行は先頭の候補（いちばん古い行）へ「同じもの」で結び、
 * id は取り込み先のものを使う（今の画面の既定「このPCに合わせる」）。それ以外は新しく作る
 */
export function suggestedMatchDecisions(
  matchCandidates: readonly ArchiveMatchCandidate[]
): Record<string, ArchiveMatchDecision> {
  return Object.fromEntries(
    matchCandidates.map((matchCandidate): [string, ArchiveMatchDecision] => {
      const oldestCandidate = matchCandidate.candidates[0]
      const decision: ArchiveMatchDecision =
        oldestCandidate &&
        matchCandidate.matchedBy === SUGGESTED_MATCH_KEY[matchCandidate.table]
          ? {
              kind: "same",
              existingId: oldestCandidate.existingId,
              adoptId: "existing",
            }
          : { kind: "new" }
      return [
        archiveRowKey(matchCandidate.table, matchCandidate.archiveId),
        decision,
      ]
    })
  )
}
