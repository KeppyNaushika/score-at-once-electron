/**
 * ローカルモードの data が「空」か（共有プロファイル → ローカルの移行先になれるか）
 *
 * 移行は丸写しで、移行先にあるものを置き換える。だから移行先に利用者のデータが
 * 1つでもあれば断る（統合したいなら、利用者がアーカイブの書き出しと取り込みを使う）。
 *
 * **「空」の基準**: 新規インストールでも、最初の起動で見本（シード）が入る
 * （`../prisma/sampleSeed.ts`）。見本は利用者のデータに数えない。それ以外は数える。
 *
 * - `data/database.db` が無い、または次のすべてを満たす
 *   - 試験・試験外成績資料・成績算出・解答用紙定義・タグが1件も無い
 *   - 利用者・学級・生徒・小計グループは、見本の名前のものしか無い
 * - 画像の置き場（`data/exams`・`data/answer-sheet-builder`）にファイルが1つも無い
 *
 * 見本の行を消した・名前を変えたなどの細かな手入れは「使った」とみなす（断る側に倒す）。
 */

import * as fs from "fs"
import * as path from "path"

import { SAMPLE_SEED_NAMES } from "../prisma/sampleSeed"
import { openAppDatabase } from "../prisma/sqliteConnection"
import type { SqliteDatabase } from "../prisma/sqliteSchemaUtils"
import { SHARED_FILE_DIRECTORIES } from "./sharedFolder"

/** 1件でもあれば利用者のデータとみなす表と、画面に出す名前 */
const TABLES_THAT_MUST_BE_EMPTY: ReadonlyArray<{
  table: string
  label: string
}> = [
  { table: "Exam", label: "試験" },
  { table: "Coursework", label: "試験外成績資料" },
  { table: "Grade", label: "成績算出" },
  { table: "AsbDefinition", label: "解答用紙定義" },
  { table: "Tag", label: "タグ" },
]

const tableExists = (db: SqliteDatabase, table: string): boolean =>
  db
    .prepare<[string], { name: string }>(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`
    )
    .get(table) !== undefined

const countRows = (
  db: SqliteDatabase,
  sql: string,
  parameters: string[]
): number => {
  const row = db.prepare<string[], { count: number }>(sql).get(...parameters)
  return row === undefined ? 0 : row.count
}

/** DB の中の、見本でない利用者のデータの種類（空なら空配列） */
function findUserDataInDatabase(databasePath: string): string[] {
  const db = openAppDatabase(databasePath)
  try {
    const found = TABLES_THAT_MUST_BE_EMPTY.filter(
      ({ table }) =>
        tableExists(db, table) &&
        countRows(db, `SELECT COUNT(*) AS count FROM "${table}"`, []) > 0
    ).map(({ label }) => label)

    const studentPlaceholders = SAMPLE_SEED_NAMES.studentNumbers
      .map(() => "?")
      .join(", ")
    const seedChecks: ReadonlyArray<{
      table: string
      label: string
      sql: string
      parameters: string[]
    }> = [
      {
        table: "User",
        label: "利用者",
        sql: `SELECT COUNT(*) AS count FROM "User" WHERE "username" <> ?`,
        parameters: [SAMPLE_SEED_NAMES.adminUsername],
      },
      {
        table: "Classroom",
        label: "学級",
        sql: `SELECT COUNT(*) AS count FROM "Classroom" WHERE "name" <> ?`,
        parameters: [SAMPLE_SEED_NAMES.classroomName],
      },
      {
        table: "Student",
        label: "生徒",
        sql: `SELECT COUNT(*) AS count FROM "Student" WHERE "studentNumber" NOT IN (${studentPlaceholders})`,
        parameters: [...SAMPLE_SEED_NAMES.studentNumbers],
      },
      {
        table: "SubtotalGroup",
        label: "小計グループ",
        sql: `SELECT COUNT(*) AS count FROM "SubtotalGroup" WHERE "name" <> ?`,
        parameters: [SAMPLE_SEED_NAMES.subtotalGroupName],
      },
    ]
    const nonSeed = seedChecks
      .filter(
        (check) =>
          tableExists(db, check.table) &&
          countRows(db, check.sql, check.parameters) > 0
      )
      .map((check) => check.label)
    return [...found, ...nonSeed]
  } finally {
    db.close()
  }
}

/** ディレクトリの下にファイルが1つでもあるか */
function containsAnyFile(directoryPath: string): boolean {
  if (!fs.existsSync(directoryPath)) return false
  return fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .some((entry) =>
      entry.isDirectory()
        ? containsAnyFile(path.join(directoryPath, entry.name))
        : true
    )
}

/**
 * ローカルモードの data に、利用者のデータがあるかを調べる。
 *
 * @returns 見つかったものの名前の一覧。空配列なら「空」
 */
export function findLocalUserData(localDataDirectory: string): string[] {
  const databasePath = path.join(localDataDirectory, "database.db")
  const inDatabase = fs.existsSync(databasePath)
    ? findUserDataInDatabase(databasePath)
    : []
  const hasImages = SHARED_FILE_DIRECTORIES.some((directoryName) =>
    containsAnyFile(path.join(localDataDirectory, directoryName))
  )
  return hasImages ? [...inDatabase, "画像"] : inDatabase
}
