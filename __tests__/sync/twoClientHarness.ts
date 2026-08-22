/**
 * 2端末同期の共通ハーネス（画面なし・本物の sqlite-nas-sync・本物のスキーマ）
 *
 * sqlite-nas-sync は Electron に依存しない素の Node ライブラリなので、
 * 一時ディレクトリに「PC-A の DB」「PC-B の DB」「NAS」を作れば実機2台を用意せずに
 * 同期の挙動を検証できる。
 *
 * **ライブラリはモックしない。** 確かめたいのはライブラリとアプリのスキーマを繋いだ
 * ときの挙動なので、片方でも作り物にすると何も確かめられない。
 *
 * DB は `globalSetup` が `prisma db push` で作る `data/test-database.db` の複製を使う。
 * つまり UNIQUE 制約も外部キーも `schema.prisma` そのままで、
 * `Tag.name` / `ExamStudent(examId, studentId)` の畳みは実際の索引が起こす。
 *
 * このファイルは `*.test.ts` ではないので vitest の収集対象にならない（`include` 参照）。
 */
import Database from "better-sqlite3"
import * as fs from "fs"
import * as path from "path"
import { setupSync, type SyncInstance } from "sqlite-nas-sync"

import {
  SYNC_EXCLUDE_TABLES,
  SYNC_TABLE_OPTIONS,
} from "../../electron-src/lib/sync/syncTableConfig"

/** globalSetup が prisma db push で作る、schema.prisma 忠実な基準DB */
export const GROUND_TRUTH_DB = path.resolve(
  __dirname,
  "../../data/test-database.db"
)

export type SqliteDatabase = InstanceType<typeof Database>

/** 短命の接続で1操作だけ行う。ライブラリ側の接続とは WAL 経由で共存する */
export const withDatabase = <T>(
  dbPath: string,
  operation: (db: SqliteDatabase) => T
): T => {
  const db = new Database(dbPath)
  try {
    return operation(db)
  } finally {
    db.close()
  }
}

/**
 * 基準DBの中身を空にする。
 *
 * `data/test-database.db` は全テストで共有され、先に走ったテストの行が残っている。
 * 「同期後にこの表は1行」と数える検証がその残骸で崩れるので、複製した直後に落とす。
 * `setupSync` より前に呼ぶこと（トリガーがまだ無いので `_changelog` を汚さない）。
 */
const clearAllRows = (db: SqliteDatabase): void => {
  const tables = db
    .prepare<[], { name: string }>(
      `SELECT name FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE '\\_%' ESCAPE '\\'
          AND name NOT LIKE 'sqlite\\_%' ESCAPE '\\'`
    )
    .all()
  db.pragma("foreign_keys = OFF")
  for (const table of tables) {
    db.exec(`DELETE FROM "${table.name}"`)
  }
}

/** 基準DBを複製してクライアントDBを用意する（同期対象テーブルは実スキーマそのもの） */
export const createClientDatabase = (dbPath: string): void => {
  if (!fs.existsSync(GROUND_TRUTH_DB)) {
    throw new Error(
      "基準DB(test-database.db)が無い。globalSetup が db push で作成する想定"
    )
  }
  fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  fs.copyFileSync(GROUND_TRUTH_DB, dbPath)
  withDatabase(dbPath, clearAllRows)
}

/** アプリと同じ除外リスト・テーブルオプションで同期インスタンスを作る */
export const createSyncInstance = (
  dbPath: string,
  clientId: string,
  nasPath: string,
  schemaVersion: string
): SyncInstance =>
  setupSync({
    dbPath,
    nasPath,
    clientId,
    excludeTables: SYNC_EXCLUDE_TABLES,
    tableOptions: SYNC_TABLE_OPTIONS,
    // テストは syncNow を明示的に呼ぶ。定期実行に割り込まれないよう十分長く取る
    intervalMs: 600_000,
    changelogRetentionDays: 7,
    schemaVersion,
  })

/**
 * アプリ（Prisma driver adapter）が書くのと同じ ISO-T 形式で「少し前」の時刻を作る。
 *
 * 未来の時刻を置くと、`_tombstone.deletedAt`（トリガーの `datetime('now')` = UTC）との
 * LWW 比較が実時刻に依存して揺れる。基準を常に過去へ置き、分の差で勝敗を決める。
 */
export const isoMinutesAgo = (minutes: number): string =>
  new Date(Date.now() - minutes * 60_000).toISOString().replace("Z", "+00:00")

/**
 * 同期を止めうる警告だけを拾う。
 *
 * 畳みが壊れているときの症状はここに出る — ユニーク違反で取り込みが落ちるか、
 * 子の付け替えに失敗して外部キーで落ちるか。空でなければ「その相手からは以後
 * 何も届かない」状態になっている。
 */
export const blockingWarnings = (warnings: string[]): string[] =>
  warnings.filter(
    (warning) =>
      warning.includes("UNIQUE constraint failed") ||
      warning.includes("FOREIGN KEY")
  )

// ---------------------------------------------------------------------------
// 行の投入（Prisma を通さず生SQL。同期はDBのトリガーが拾うので経路は同じ）
// ---------------------------------------------------------------------------

export const insertTag = (
  dbPath: string,
  tag: { id: string; name: string; updatedAt: string }
): void => {
  withDatabase(dbPath, (db) =>
    db
      .prepare(
        `INSERT INTO "Tag" (id, name, "order", "createdAt", "updatedAt")
         VALUES (?, ?, 0, ?, ?)`
      )
      .run(tag.id, tag.name, tag.updatedAt, tag.updatedAt)
  )
}

export const renameTag = (
  dbPath: string,
  tag: { id: string; name: string; updatedAt: string }
): void => {
  withDatabase(dbPath, (db) =>
    db
      .prepare(`UPDATE "Tag" SET name = ?, "updatedAt" = ? WHERE id = ?`)
      .run(tag.name, tag.updatedAt, tag.id)
  )
}

export const deleteTag = (dbPath: string, id: string): void => {
  withDatabase(dbPath, (db) =>
    db.prepare(`DELETE FROM "Tag" WHERE id = ?`).run(id)
  )
}

export const tagRows = (dbPath: string): Array<{ id: string; name: string }> =>
  withDatabase(dbPath, (db) =>
    db
      .prepare<[], { id: string; name: string }>(
        `SELECT id, name FROM "Tag" ORDER BY id`
      )
      .all()
  )

/**
 * 採点1マスまで届く最小の骨組みを1端末へ入れる。
 *
 * ExamStudent の畳み（`@@unique([examId, studentId])`）を起こすには、
 * 両端末が同じ試験・同じ生徒を持っている必要がある。ここで作った骨組みを
 * 先に同期しておくと、あとは各端末が独立に ExamStudent を作るだけで衝突が起きる。
 */
export const seedScoringSkeleton = (
  dbPath: string,
  updatedAt: string
): {
  examId: string
  studentId: string
  userId: string
  cropRegionId: string
} => {
  const examId = "exam-collision"
  const studentId = "student-collision"
  const userId = "user-collision"
  const examPageId = "exam-page-collision"
  const cropRegionId = "crop-region-collision"

  withDatabase(dbPath, (db) => {
    db.prepare(
      `INSERT INTO "Exam" (id, "examName", "markerCorrectionEnabled", "createdAt", "updatedAt")
       VALUES (?, ?, 0, ?, ?)`
    ).run(examId, "期末考査", updatedAt, updatedAt)

    db.prepare(
      `INSERT INTO "Student"
         (id, "studentNumber", "lastName", "firstName", "lastNameKana", "firstNameKana", "createdAt", "updatedAt")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      studentId,
      "1001",
      "山田",
      "太郎",
      "やまだ",
      "たろう",
      updatedAt,
      updatedAt
    )

    db.prepare(
      `INSERT INTO "User" (id, username, name, role, "createdAt", "updatedAt")
       VALUES (?, ?, ?, 'teacher', ?, ?)`
    ).run(userId, "teacher-a", "採点者A", updatedAt, updatedAt)

    db.prepare(
      `INSERT INTO "ExamPage" (id, "examId", "pageNumber", "imagePath", "pageSize", "createdAt", "updatedAt")
       VALUES (?, ?, 1, ?, 'A4', ?, ?)`
    ).run(examPageId, examId, "master/page-1.png", updatedAt, updatedAt)

    db.prepare(
      `INSERT INTO "CropRegion"
         (id, "examPageId", label, type, x, y, width, height, points, "orderIndex", "createdAt", "updatedAt")
       VALUES (?, ?, ?, 'question', 0.1, 0.1, 0.2, 0.1, 10, 0, ?, ?)`
    ).run(cropRegionId, examPageId, "大問1(1)", updatedAt, updatedAt)
  })

  return { examId, studentId, userId, cropRegionId }
}

export const insertExamStudent = (
  dbPath: string,
  examStudent: {
    id: string
    examId: string
    studentId: string
    updatedAt: string
  }
): void => {
  withDatabase(dbPath, (db) =>
    db
      .prepare(
        `INSERT INTO "ExamStudent" (id, "examId", "studentId", status, "createdAt", "updatedAt")
         VALUES (?, ?, ?, 'participating', ?, ?)`
      )
      .run(
        examStudent.id,
        examStudent.examId,
        examStudent.studentId,
        examStudent.updatedAt,
        examStudent.updatedAt
      )
  )
}

export const insertQuestionScore = (
  dbPath: string,
  questionScore: {
    id: string
    cropRegionId: string
    examStudentId: string
    userId: string
    status: string
    updatedAt: string
  }
): void => {
  withDatabase(dbPath, (db) =>
    db
      .prepare(
        `INSERT INTO "QuestionScore"
           (id, "cropRegionId", "examStudentId", "partialScore", status, "userId", "createdAt", "updatedAt")
         VALUES (?, ?, ?, NULL, ?, ?, ?, ?)`
      )
      .run(
        questionScore.id,
        questionScore.cropRegionId,
        questionScore.examStudentId,
        questionScore.status,
        questionScore.userId,
        questionScore.updatedAt,
        questionScore.updatedAt
      )
  )
}

export const examStudentRows = (
  dbPath: string
): Array<{ id: string; examId: string; studentId: string }> =>
  withDatabase(dbPath, (db) =>
    db
      .prepare<[], { id: string; examId: string; studentId: string }>(
        `SELECT id, "examId" AS examId, "studentId" AS studentId
           FROM "ExamStudent" ORDER BY id`
      )
      .all()
  )

export const questionScoreRows = (
  dbPath: string
): Array<{ id: string; examStudentId: string; status: string }> =>
  withDatabase(dbPath, (db) =>
    db
      .prepare<[], { id: string; examStudentId: string; status: string }>(
        `SELECT id, "examStudentId" AS examStudentId, status
           FROM "QuestionScore" ORDER BY id`
      )
      .all()
  )

/** ライブラリが端末をまたいで畳み先を伝えるための墓標（`mergedInto`） */
export const tombstoneRows = (
  dbPath: string,
  tableName: string
): Array<{ recordId: string; mergedInto: string | null }> =>
  withDatabase(dbPath, (db) =>
    db
      .prepare<[string], { recordId: string; mergedInto: string | null }>(
        `SELECT recordId, mergedInto FROM _tombstone
          WHERE tableName = ? ORDER BY recordId`
      )
      .all(tableName)
  )

/** ローカルの読み替え索引（あとから届く敗者の子を勝者へ向け直すために使う） */
export const idMergeRows = (
  dbPath: string,
  tableName: string
): Array<{ losingId: string; winningId: string }> =>
  withDatabase(dbPath, (db) =>
    db
      .prepare<[string], { losingId: string; winningId: string }>(
        `SELECT losingId, winningId FROM _id_merge
          WHERE tableName = ? ORDER BY losingId`
      )
      .all(tableName)
  )
