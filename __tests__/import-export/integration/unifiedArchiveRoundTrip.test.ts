/**
 * 統合アーカイブ（.sao）の端から端: 書き出す → 開く → 行を取り込む → ファイルを取り込む
 *
 * テスト対象（つないだ全体）:
 *   electron-src/lib/export/unified-archive/unifiedArchiveCreator.ts
 *   electron-src/lib/import/unified-archive/archiveOpener.ts
 *   electron-src/lib/import/unified-archive/archiveRowImporter.ts
 *   electron-src/lib/import/unified-archive/archiveFileImporter.ts
 *
 * 段階3の終わりの条件（docs/unified-archive-design.md §10）: 書き出し → 取り込みの往復で行が一致する。
 * 各部品の規則は unifiedArchiveCreate / unifiedArchiveOpen / unifiedArchiveImport の各テストが見る。
 * ここは、部品を本番と同じ順でつないで、空にした DB へ統合で取り込むと元に戻ることだけを見る。
 *
 * テスト DB は migration でなく schema から直に作るので `_prisma_migrations` を持たない。開く側は
 * それを必要とするため、テスト DB の複製にアプリの全 migration を適用済みとして記録し、それを
 * 書き出し元にする（表・列は現行のスキーマそのものなので、開く側が当てる migration は無い）。
 */

import Database from "better-sqlite3"
import * as crypto from "crypto"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { createUnifiedArchive } from "../../../electron-src/lib/export/unified-archive/unifiedArchiveCreator"
import { importUnifiedArchiveFiles } from "../../../electron-src/lib/import/unified-archive/archiveFileImporter"
import { openUnifiedArchive } from "../../../electron-src/lib/import/unified-archive/archiveOpener"
import { listLocalMigrationNames } from "../../../electron-src/lib/prisma/schema/migrationApplier"
import {
  cleanupTestDatabase,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"
import {
  createUnifiedArchiveFileFixture,
  type UnifiedArchiveFileFixture,
  writeDataDirectoryFiles,
} from "../../helpers/unifiedArchiveFileFixture"
import {
  createUnifiedArchiveFixture,
  type UnifiedArchiveFixture,
} from "../../helpers/unifiedArchiveFixture"
import {
  findDanglingReferences,
  importArchiveRows,
  readRowsByIds,
  readTableIds,
} from "../../helpers/unifiedArchiveImportHelpers"

const prisma = getTestPrismaClient()
const TEST_DB_PATH = path.resolve(__dirname, "../../../data/test-database.db")
const APP_MIGRATIONS_DIR = path.resolve(__dirname, "../../../prisma/migrations")
const WORK_DIR = path.join(os.tmpdir(), "unified-archive-round-trip")
const DATA_DIR = path.join(WORK_DIR, "data")
const SOURCE_PATH = path.join(WORK_DIR, "source.db")
const OUTPUT_PATH = path.join(WORK_DIR, "export.sao")
const OPENED_DIR = path.join(WORK_DIR, "opened")
const IMPORTED_AT = new Date("2026-10-05T09:00:00.000Z")

/** テスト DB を複製し、アプリの全 migration を適用済みとして記録する */
const createSourceWithMigrations = (): void => {
  const testDatabase = new Database(TEST_DB_PATH, {
    readonly: true,
    fileMustExist: true,
  })
  try {
    testDatabase.prepare<[string]>("VACUUM INTO ?").run(SOURCE_PATH)
  } finally {
    testDatabase.close()
  }
  const source = new Database(SOURCE_PATH, { fileMustExist: true })
  try {
    source.exec(`DROP TABLE IF EXISTS "_prisma_migrations"`)
    source.exec(`
      CREATE TABLE "_prisma_migrations" (
        "id" TEXT PRIMARY KEY NOT NULL,
        "checksum" TEXT NOT NULL,
        "finished_at" DATETIME,
        "migration_name" TEXT NOT NULL,
        "logs" TEXT,
        "rolled_back_at" DATETIME,
        "started_at" DATETIME NOT NULL DEFAULT current_timestamp,
        "applied_steps_count" INTEGER NOT NULL DEFAULT 0
      )
    `)
    const insertMigration = source.prepare<[string, string]>(
      `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, applied_steps_count)
       VALUES (?, 'checksum', ?, '2026-10-04T00:00:00.000Z', 1)`
    )
    for (const migrationName of listLocalMigrationNames(APP_MIGRATIONS_DIR)) {
      insertMigration.run(crypto.randomUUID(), migrationName)
    }
  } finally {
    source.close()
  }
}

describe("統合アーカイブの往復（書き出す → 開く → 取り込む）", () => {
  let fixture: UnifiedArchiveFixture
  let fileFixture: UnifiedArchiveFileFixture
  let fileContentsByPath: Map<string, Buffer>

  const allImagePaths = (): string[] =>
    [
      ...new Set([
        ...fileFixture.examPageImagePaths,
        ...fileFixture.studentAnswerImagePaths,
        ...fileFixture.asbImagePaths,
      ]),
    ].sort()

  beforeEach(async () => {
    await cleanupTestDatabase()
    fs.rmSync(WORK_DIR, { recursive: true, force: true })
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fixture = await createUnifiedArchiveFixture(prisma)
    fileFixture = await createUnifiedArchiveFileFixture(prisma, fixture)
    fileContentsByPath = writeDataDirectoryFiles(DATA_DIR, allImagePaths())
    await prisma.returnSnapshot.create({
      data: {
        examStudentId: fixture.examA.examStudents[0].id,
        scoresJson: JSON.stringify({
          v: 1,
          scores: [{ r: fixture.examA.cropRegions[0].id, s: "correct" }],
          annotations: [],
        }),
      },
    })
  })

  afterAll(async () => {
    fs.rmSync(WORK_DIR, { recursive: true, force: true })
    await disconnectTestPrisma()
  })

  it("空にした DB へ統合で取り込むと、範囲の全表の行が全列で書き出し前と一致し、画像も中身まで一致する", async () => {
    createSourceWithMigrations()
    await createUnifiedArchive({
      sourceDatabasePath: SOURCE_PATH,
      dataDirectory: DATA_DIR,
      outputPath: OUTPUT_PATH,
      selection: {
        roots: {
          Exam: [fixture.examA.exam.id],
          Coursework: [fixture.courseworkId],
          Grade: [fixture.gradeId],
          AsbDefinition: [fileFixture.asbDefinitionId],
        },
        optionalItems: ["userSettings"],
      },
      exportedByUserId: fixture.examA.user.id,
      appVersion: "0.0.0-test",
    })

    const archive = openUnifiedArchive({
      archivePath: OUTPUT_PATH,
      workDirectory: OPENED_DIR,
      migrationsDir: APP_MIGRATIONS_DIR,
      referenceDatabasePath: TEST_DB_PATH,
    })
    // 書き出し元は現行のスキーマなので、開く側が当てる migration は無い
    expect(archive.appliedMigrations).toEqual([])
    const archiveIds = readTableIds(archive.databasePath)
    for (const table of [
      "Exam",
      "Coursework",
      "Grade",
      "AsbImageElement",
      "QuestionScore",
      "ReturnSnapshot",
      "UserPreference",
    ]) {
      expect(archiveIds.get(table)?.length ?? 0, table).toBeGreaterThan(0)
    }
    const rowsBeforeExport = readRowsByIds(TEST_DB_PATH, archiveIds)

    await cleanupTestDatabase()
    fs.rmSync(DATA_DIR, { recursive: true, force: true })
    fs.mkdirSync(DATA_DIR, { recursive: true })
    for (const [table, rows] of readRowsByIds(TEST_DB_PATH, archiveIds)) {
      expect(rows, `${table} が空になっていない`).toEqual([])
    }

    const plan = await importArchiveRows(prisma, archive, "merge", IMPORTED_AT)
    const files = importUnifiedArchiveFiles(
      archive,
      DATA_DIR,
      "merge",
      plan.idMap
    )

    expect(plan.uniqueConflicts).toEqual([])
    expect(plan.warnings).toEqual([])
    for (const [table, ids] of archiveIds) {
      expect(plan.counts[table], table).toEqual({
        created: ids.length,
        replaced: 0,
        kept: 0,
      })
    }
    const rowsAfterImport = readRowsByIds(TEST_DB_PATH, archiveIds)
    for (const [table, rows] of rowsBeforeExport) {
      expect(rowsAfterImport.get(table), table).toEqual(rows)
    }
    expect(findDanglingReferences(TEST_DB_PATH)).toEqual([])

    expect(files.failed).toEqual([])
    expect(files.copied.sort()).toEqual(allImagePaths())
    for (const imagePath of allImagePaths()) {
      const importedPath = path.join(DATA_DIR, ...imagePath.split("/"))
      expect(
        fs
          .readFileSync(importedPath)
          .equals(fileContentsByPath.get(imagePath) ?? Buffer.alloc(0)),
        imagePath
      ).toBe(true)
    }
  })
})
