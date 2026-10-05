/**
 * 統合アーカイブ（.sao）の書き出しの下見
 *
 * 書き出し画面（docs/unified-archive-design.md §6）が、選択を変えるたびに呼ぶ。範囲は書き出しと
 * 同じ `resolveArchiveScope` で決め、DB は書かない。返すのは生の id と件数だけで、名前や文言は
 * renderer が既存の一覧から引いて作る。
 *
 * electron（app・dataManager）には依存しない。DB とデータディレクトリの場所は呼び出し側が渡す。
 */

import Database from "better-sqlite3"
import * as fs from "fs"

import type { UnifiedArchiveMissingFile } from "../../../../src/types/unifiedArchive.types"
import {
  ARCHIVE_FILE_COLUMNS,
  resolveArchiveFile,
} from "./archiveFileCollector"
import {
  type ArchiveScope,
  ArchiveScopeError,
  type ArchiveSelection,
  loadScopeRows,
  resolveArchiveScope,
} from "./archiveScopeResolver"
import { ARCHIVE_TABLES } from "./archiveTableRegistry"

/** 画面が名前を引いて並べる実体（重い表の id は返さない） */
export type ArchivePreviewEntityTable =
  | "Exam"
  | "Coursework"
  | "Grade"
  | "AsbDefinition"
  | "Student"
  | "Classroom"
  | "SubtotalGroup"
  | "Tag"
  | "User"

export type UnifiedArchiveExportPreview =
  | {
      kind: "ok"
      /** 表名 → 範囲に入る行の数（0 の表は載せない） */
      rowCounts: Record<string, number>
      /** 表名 → 外したことで入らなくなった行の数 */
      excludedRowCounts: Record<string, number>
      /** 実体の表 → 範囲に入る行の id */
      entityIds: Record<ArchivePreviewEntityTable, string[]>
      /**
       * `${表名}:${id}` → それを使うため外せない成績算出の id。成績算出のデータソースが指す行と、
       * その行を所有する親を根・共通の実体まで辿った行（試験・資料・小計グループ）が載る
       */
      forcedBy: Record<string, string[]>
      /** 範囲内の行が指すのに、データディレクトリに無い・外を指すファイル */
      missingFiles: UnifiedArchiveMissingFile[]
    }
  | { kind: "forcedExcluded"; violations: ArchiveScopeError["violations"] }

export interface PreviewUnifiedArchiveExportOptions {
  sourceDatabasePath: string
  /** DB のファイルパス（imagePath など）の基点 */
  dataDirectory: string
  selection: ArchiveSelection
}

type ScopeTableRows = ReturnType<typeof loadScopeRows>

/** 同梱できないファイルの理由。同梱できるなら null */
type FileProblem = UnifiedArchiveMissingFile["reason"] | null

/**
 * 下見どうしで使い回すもの。
 *
 * 書き出し画面は選択を変えるたび・行に当てるたびに下見を引くが、DB が変わっていなければ
 * 読む行も、そこから作る範囲の索引（`resolveArchiveScope` が行ごとに覚える）も同じになる。
 * 毎回読み直すと、生徒千人・採点4万件の DB で下見1回に約250ms かかっていた。
 *
 * 読み取りの接続を開いたままにし、`PRAGMA data_version`（他の接続が書くと変わる）で DB が
 * 変わったかを見る。DB が別のファイルに置き換わったら（inode が変わったら）開き直す。
 * ファイルの有無も DB が変わるまで覚える（書き出しは改めて確かめるので、外で消されたファイルを
 * 書き出しの結果が見落とすことはない）。
 */
interface PreviewSource {
  readonly databasePath: string
  readonly inode: number
  readonly connection: Database.Database
  readonly dataVersion: number
  readonly tableRows: ScopeTableRows
  /** データディレクトリ → ファイルのパス → 同梱できないなら理由 */
  readonly fileProblems: Map<string, Map<string, FileProblem>>
}

let previewSource: PreviewSource | null = null

const closePreviewSource = (): void => {
  previewSource?.connection.close()
  previewSource = null
}

/** 今の DB の行。前の下見から DB が変わっていなければ、前に読んだものを返す */
const previewSourceOf = (databasePath: string): PreviewSource => {
  const inode = fs.statSync(databasePath).ino
  if (
    previewSource !== null &&
    (previewSource.databasePath !== databasePath ||
      previewSource.inode !== inode)
  ) {
    closePreviewSource()
  }
  const connection =
    previewSource?.connection ??
    new Database(databasePath, { readonly: true, fileMustExist: true })
  const dataVersion = Number(
    connection.pragma("data_version", { simple: true })
  )
  if (previewSource !== null && previewSource.dataVersion === dataVersion) {
    return previewSource
  }
  try {
    previewSource = {
      databasePath,
      inode,
      connection,
      dataVersion,
      tableRows: loadScopeRows(connection),
      fileProblems: new Map(),
    }
  } catch (error) {
    connection.close()
    previewSource = null
    throw error
  }
  return previewSource
}

const idsOf = (scope: ArchiveScope, table: string): ReadonlySet<string> =>
  scope.rows.get(table) ?? new Set()

const cellOf = (
  tableRows: ScopeTableRows,
  table: string,
  id: string,
  column: string
): string | null => tableRows.get(table)?.get(id)?.values[column] ?? null

/** 行を所有する親（owner の列のうち値の入っている最初のもの）。根と共通の実体は親を持たない */
const ownerOf = (
  tableRows: ScopeTableRows,
  table: string,
  id: string
): { table: string; id: string } | null => {
  const spec = ARCHIVE_TABLES[table]
  if (!spec || spec.role === "root" || spec.role === "shared") return null
  for (const column of spec.owner ?? []) {
    const parentId = cellOf(tableRows, table, id, column)
    if (parentId === null) continue
    const reference = spec.references.find(
      (candidate) => candidate.column === column
    )
    if (reference) return { table: reference.table, id: parentId }
  }
  return null
}

/** 範囲内のデータソースが外せなくしている行 → それを使う成績算出 */
const collectForcedBy = (
  tableRows: ScopeTableRows,
  scope: ArchiveScope
): Record<string, string[]> => {
  const gradeIdsByKey = new Map<string, Set<string>>()
  const forcedReferences = ARCHIVE_TABLES.GradeDataSource.references.filter(
    (reference) => reference.forced
  )
  for (const dataSourceId of idsOf(scope, "GradeDataSource")) {
    const gradeItemId = cellOf(
      tableRows,
      "GradeDataSource",
      dataSourceId,
      "gradeItemId"
    )
    const gradeId =
      gradeItemId === null
        ? null
        : cellOf(tableRows, "GradeItem", gradeItemId, "gradeId")
    if (gradeId === null) continue
    for (const reference of forcedReferences) {
      const targetId = cellOf(
        tableRows,
        "GradeDataSource",
        dataSourceId,
        reference.column
      )
      let current: { table: string; id: string } | null =
        targetId === null ? null : { table: reference.table, id: targetId }
      while (current) {
        const key = `${current.table}:${current.id}`
        const gradeIds = gradeIdsByKey.get(key) ?? new Set<string>()
        gradeIds.add(gradeId)
        gradeIdsByKey.set(key, gradeIds)
        current = ownerOf(tableRows, current.table, current.id)
      }
    }
  }
  return Object.fromEntries(
    [...gradeIdsByKey].map(([key, gradeIds]) => [key, [...gradeIds].sort()])
  )
}

/** 範囲内の行が指すファイルのうち、同梱できないもの（書き出しと同じ規則） */
const collectMissingFiles = (
  source: PreviewSource,
  scope: ArchiveScope,
  dataDirectory: string
): UnifiedArchiveMissingFile[] => {
  const fileProblems =
    source.fileProblems.get(dataDirectory) ?? new Map<string, FileProblem>()
  source.fileProblems.set(dataDirectory, fileProblems)
  const filePaths = new Set<string>()
  for (const fileColumn of ARCHIVE_FILE_COLUMNS) {
    const scopedIds = idsOf(scope, fileColumn.table)
    if (scopedIds.size === 0) continue
    const records = source.connection
      .prepare<[], { id: string; filePath: string }>(
        `SELECT "id" AS id, "${fileColumn.column}" AS filePath FROM "${fileColumn.table}"
         WHERE "${fileColumn.column}" IS NOT NULL AND "${fileColumn.column}" <> ''`
      )
      .all()
    for (const record of records) {
      if (scopedIds.has(record.id)) filePaths.add(record.filePath)
    }
  }
  return [...filePaths]
    .sort()
    .flatMap((filePath): UnifiedArchiveMissingFile[] => {
      let problem = fileProblems.get(filePath)
      if (problem === undefined) {
        problem = fileProblemOf(dataDirectory, filePath)
        fileProblems.set(filePath, problem)
      }
      return problem === null ? [] : [{ path: filePath, reason: problem }]
    })
}

const fileProblemOf = (
  dataDirectory: string,
  filePath: string
): FileProblem => {
  const resolved = resolveArchiveFile(dataDirectory, filePath)
  if (resolved.kind === "outsideDataDirectory") return "outsideDataDirectory"
  const fileStat = fs.statSync(resolved.absolutePath, {
    throwIfNoEntry: false,
  })
  return fileStat?.isFile() ? null : "notFound"
}

/** 選択から、書き出す範囲の件数・実体の id・外せない理由・欠けたファイルを返す */
export function previewUnifiedArchiveExport(
  options: PreviewUnifiedArchiveExportOptions
): UnifiedArchiveExportPreview {
  const source = previewSourceOf(options.sourceDatabasePath)
  const { tableRows } = source
  let scope: ArchiveScope
  try {
    scope = resolveArchiveScope(tableRows, options.selection)
  } catch (error) {
    if (error instanceof ArchiveScopeError) {
      return { kind: "forcedExcluded", violations: error.violations }
    }
    throw error
  }

  const rowCounts: Record<string, number> = {}
  for (const [table, ids] of scope.rows) {
    if (ids.size > 0) rowCounts[table] = ids.size
  }
  const sortedIdsOf = (table: ArchivePreviewEntityTable): string[] =>
    [...idsOf(scope, table)].sort()
  const entityIds: Record<ArchivePreviewEntityTable, string[]> = {
    Exam: sortedIdsOf("Exam"),
    Coursework: sortedIdsOf("Coursework"),
    Grade: sortedIdsOf("Grade"),
    AsbDefinition: sortedIdsOf("AsbDefinition"),
    Student: sortedIdsOf("Student"),
    Classroom: sortedIdsOf("Classroom"),
    SubtotalGroup: sortedIdsOf("SubtotalGroup"),
    Tag: sortedIdsOf("Tag"),
    User: sortedIdsOf("User"),
  }

  return {
    kind: "ok",
    rowCounts,
    excludedRowCounts: { ...scope.excludedRowCounts },
    entityIds,
    forcedBy: collectForcedBy(tableRows, scope),
    missingFiles: collectMissingFiles(source, scope, options.dataDirectory),
  }
}
