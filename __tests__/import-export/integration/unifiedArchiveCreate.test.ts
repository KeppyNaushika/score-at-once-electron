/**
 * 統合アーカイブ（.sao）の ZIP の書き出し
 *
 * テスト対象:
 *   electron-src/lib/export/unified-archive/unifiedArchiveCreator.ts
 *   （archiveFileCollector.ts と archiveDatabaseWriter.ts の passcode の扱いを含む）
 *
 * 形は docs/unified-archive-design.md §4:
 * - ZIP の中身は manifest.json・archive.db・files/…（データディレクトリからの相対パスのまま）だけ
 * - archive.db は外部キーが閉じ、トリガー・ビューを持たず、利用者の passcode は空
 * - manifest.json は形式・版・書き出し時刻・選んだ範囲・利用者が外したもの・表ごとの行数を持つ
 * - 画像が欠けていても書き出しは続け、欠けたものを manifest に残す
 */

import AdmZip from "adm-zip"
import Database from "better-sqlite3"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import {
  ArchiveScopeError,
  type ArchiveSelection,
  loadScopeRows,
  resolveArchiveScope,
} from "../../../electron-src/lib/export/unified-archive/archiveScopeResolver"
import {
  createUnifiedArchive,
  type CreateUnifiedArchiveOptions,
  type UnifiedArchiveExportPhase,
} from "../../../electron-src/lib/export/unified-archive/unifiedArchiveCreator"
import {
  UNIFIED_ARCHIVE_DATABASE_NAME,
  UNIFIED_ARCHIVE_FILES_DIR,
  UNIFIED_ARCHIVE_FORMAT,
  UNIFIED_ARCHIVE_FORMAT_VERSION,
  UNIFIED_ARCHIVE_MANIFEST_NAME,
} from "../../../src/types/unifiedArchive.types"
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

const prisma = getTestPrismaClient()
const TEST_DB_PATH = path.resolve(__dirname, "../../../data/test-database.db")
const WORK_DIR = path.join(os.tmpdir(), "unified-archive-create")
const DATA_DIR = path.join(WORK_DIR, "data")
/** beforeEach では作らない（出力先のディレクトリが無ければ作られることも見る） */
const OUTPUT_DIR = path.join(WORK_DIR, "output")
const OUTPUT_PATH = path.join(OUTPUT_DIR, "export.sao")
const EXPORTED_AT = new Date("2026-10-04T01:23:45.000Z")
const APP_VERSION = "0.0.0-test"
const FILES_PREFIX = `${UNIFIED_ARCHIVE_FILES_DIR}/`

interface ExtractedArchive {
  /** ディレクトリの項目を除いた、ZIP の全ての項目名（並べたもの） */
  entryNames: string[]
  manifestJson: unknown
  /** 取り出した archive.db の置き場 */
  databasePath: string
  /** files/ を除いた相対パス → 中身 */
  fileContentsByPath: Map<string, Buffer>
}

const extractArchive = (outputPath: string): ExtractedArchive => {
  const zip = new AdmZip(outputPath)
  const entries = zip.getEntries().filter((entry) => !entry.isDirectory)
  const manifestEntry = zip.getEntry(UNIFIED_ARCHIVE_MANIFEST_NAME)
  const databaseEntry = zip.getEntry(UNIFIED_ARCHIVE_DATABASE_NAME)
  if (!manifestEntry || !databaseEntry) {
    throw new Error(`manifest.json か archive.db がありません: ${outputPath}`)
  }
  const databasePath = path.join(
    WORK_DIR,
    `${path.basename(outputPath)}.${UNIFIED_ARCHIVE_DATABASE_NAME}`
  )
  fs.rmSync(databasePath, { force: true })
  fs.writeFileSync(databasePath, databaseEntry.getData())
  const manifestJson: unknown = JSON.parse(
    manifestEntry.getData().toString("utf8")
  )
  const fileContentsByPath = new Map(
    entries
      .filter((entry) => entry.entryName.startsWith(FILES_PREFIX))
      .map((entry): [string, Buffer] => [
        entry.entryName.slice(FILES_PREFIX.length),
        entry.getData(),
      ])
  )
  return {
    entryNames: entries.map((entry) => entry.entryName).sort(),
    manifestJson,
    databasePath,
    fileContentsByPath,
  }
}

const withDatabase = <Result>(
  databasePath: string,
  read: (db: Database.Database) => Result
): Result => {
  const db = new Database(databasePath, { readonly: true, fileMustExist: true })
  try {
    return read(db)
  } finally {
    db.close()
  }
}

const sortedUnique = (paths: readonly string[]): string[] =>
  [...new Set(paths)].sort()

/** archive.db のファイルパスを持つ3列の、非 NULL・非空の値 */
const imagePathsInDatabase = (db: Database.Database): string[] =>
  sortedUnique(
    ["ExamPage", "StudentAnswerImage", "AsbImageElement"].flatMap((table) =>
      db
        .prepare<[], { imagePath: string }>(
          `SELECT imagePath FROM "${table}" WHERE imagePath IS NOT NULL AND imagePath <> ''`
        )
        .all()
        .map((imageRow) => imageRow.imagePath)
    )
  )

/** アプリの表ごとの行数（0 の表は載せない。sqlite_ と _ で始まる表は数えない） */
const countApplicationRows = (
  db: Database.Database
): Record<string, number> => {
  const tableNames = db
    .prepare<[], { name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_%' ESCAPE '\\'"
    )
    .all()
    .map((tableRow) => tableRow.name)
  const rowCounts: Record<string, number> = {}
  for (const tableName of tableNames) {
    const countRow = db
      .prepare<[], { count: number }>(
        `SELECT COUNT(*) AS count FROM "${tableName}"`
      )
      .get()
    if (countRow && countRow.count > 0) rowCounts[tableName] = countRow.count
  }
  return rowCounts
}

/** テスト DB を作業場所へ複製する（元 DB を書き換えるテストは複製だけを触る） */
const copyTestDatabase = (fileName: string): string => {
  const copyPath = path.join(WORK_DIR, fileName)
  withDatabase(TEST_DB_PATH, (db) => {
    db.prepare<[string]>("VACUUM INTO ?").run(copyPath)
  })
  return copyPath
}

const modifyDatabase = (
  databasePath: string,
  modify: (db: Database.Database) => void
): void => {
  const db = new Database(databasePath, { fileMustExist: true })
  try {
    modify(db)
  } finally {
    db.close()
  }
}

describe("統合アーカイブの書き出し", () => {
  let fixture: UnifiedArchiveFixture
  let fileFixture: UnifiedArchiveFileFixture
  let fileContentsByPath: Map<string, Buffer>

  const allImagePaths = (): string[] =>
    sortedUnique([
      ...fileFixture.examPageImagePaths,
      ...fileFixture.studentAnswerImagePaths,
      ...fileFixture.asbImagePaths,
    ])

  const examAImagePaths = (): string[] =>
    sortedUnique([
      ...fileFixture.examPageImagePaths,
      ...fileFixture.studentAnswerImagePaths,
    ])

  const exportArchive = (
    selection: ArchiveSelection,
    overrides: Partial<CreateUnifiedArchiveOptions> = {}
  ) =>
    createUnifiedArchive({
      sourceDatabasePath: TEST_DB_PATH,
      dataDirectory: DATA_DIR,
      outputPath: OUTPUT_PATH,
      selection,
      exportedByUserId: fixture.examA.user.id,
      appVersion: APP_VERSION,
      now: () => EXPORTED_AT,
      ...overrides,
    })

  beforeEach(async () => {
    await cleanupTestDatabase()
    fs.rmSync(WORK_DIR, { recursive: true, force: true })
    fs.mkdirSync(DATA_DIR, { recursive: true })
    fixture = await createUnifiedArchiveFixture(prisma)
    fileFixture = await createUnifiedArchiveFileFixture(prisma, fixture)
    fileContentsByPath = writeDataDirectoryFiles(DATA_DIR, allImagePaths())
  })

  afterAll(async () => {
    fs.rmSync(WORK_DIR, { recursive: true, force: true })
    await disconnectTestPrisma()
  })

  describe("ZIP の中身", () => {
    it("manifest.json・archive.db・files/… だけを持ち、files/ は archive.db の画像パスと過不足なく一致し、中身も同じ", async () => {
      await exportArchive({
        roots: {
          Exam: [fixture.examA.exam.id],
          AsbDefinition: [fileFixture.asbDefinitionId],
        },
      })

      const extracted = extractArchive(OUTPUT_PATH)
      const pathsInDatabase = withDatabase(
        extracted.databasePath,
        imagePathsInDatabase
      )

      expect(pathsInDatabase).toEqual(allImagePaths())
      expect(extracted.entryNames).toEqual(
        [
          UNIFIED_ARCHIVE_MANIFEST_NAME,
          UNIFIED_ARCHIVE_DATABASE_NAME,
          ...pathsInDatabase.map((imagePath) => `${FILES_PREFIX}${imagePath}`),
        ].sort()
      )
      for (const imagePath of pathsInDatabase) {
        expect(
          extracted.fileContentsByPath
            .get(imagePath)
            ?.equals(fileContentsByPath.get(imagePath) ?? Buffer.alloc(0)),
          imagePath
        ).toBe(true)
      }
    })

    it("archive.db は整合し、外部キーが閉じ、トリガー・ビューを持たず、利用者の passcode が空になる", async () => {
      await prisma.user.update({
        where: { id: fixture.examA.user.id },
        data: { passcode: "1234", passcodeType: "pin" },
      })
      await prisma.user.update({
        where: { id: fixture.otherScorer.id },
        data: { passcode: "secret", passcodeType: "password" },
      })
      // 同期のトリガーやビューを持つ元 DB でも、書き出しには残らない
      const sourcePath = copyTestDatabase("source-with-objects.db")
      modifyDatabase(sourcePath, (db) => {
        db.exec(`CREATE VIEW "exam_names" AS SELECT examName FROM "Exam"`)
        db.exec(
          `CREATE TRIGGER "exam_touch" AFTER UPDATE ON "Exam" BEGIN UPDATE "Exam" SET examName = examName WHERE 0; END`
        )
      })

      await exportArchive(
        { roots: { Exam: [fixture.examA.exam.id] } },
        { sourceDatabasePath: sourcePath }
      )

      const extracted = extractArchive(OUTPUT_PATH)
      const sourceUpdatedAtById = withDatabase(
        sourcePath,
        (db) =>
          new Map(
            db
              .prepare<[], { id: string; updatedAt: string | number }>(
                `SELECT id, updatedAt FROM "User"`
              )
              .all()
              .map((userRow): [string, string | number] => [
                userRow.id,
                userRow.updatedAt,
              ])
          )
      )
      withDatabase(extracted.databasePath, (db) => {
        expect(db.pragma("integrity_check", { simple: true })).toBe("ok")
        expect(db.pragma("foreign_key_check")).toEqual([])
        expect(
          db
            .prepare<[], { name: string }>(
              "SELECT name FROM sqlite_master WHERE type IN ('trigger', 'view')"
            )
            .all()
        ).toEqual([])

        const users = db
          .prepare<
            [],
            {
              id: string
              passcode: string | null
              passcodeType: string | null
              updatedAt: string | number
            }
          >(`SELECT id, passcode, passcodeType, updatedAt FROM "User"`)
          .all()
        expect(users.map((user) => user.id)).toEqual(
          expect.arrayContaining([
            fixture.examA.user.id,
            fixture.otherScorer.id,
          ])
        )
        for (const user of users) {
          expect(user.passcode, user.id).toBeNull()
          expect(user.passcodeType, user.id).toBe("none")
          // passcode を空にしても、更新時刻は元のまま（LWW の判定を動かさない）
          expect(user.updatedAt, user.id).toBe(sourceUpdatedAtById.get(user.id))
        }
      })
    })
  })

  describe("manifest.json", () => {
    it("形式・版・書き出し時刻・利用者・既定値を明示した範囲・実際の行数・ファイル数を持つ", async () => {
      const result = await exportArchive({
        roots: {
          Exam: [fixture.examA.exam.id],
          AsbDefinition: [fileFixture.asbDefinitionId],
          Coursework: [],
        },
      })

      const extracted = extractArchive(OUTPUT_PATH)
      const { manifest } = result
      expect(result.outputPath).toBe(OUTPUT_PATH)
      expect(extracted.manifestJson).toEqual(manifest)

      expect(manifest.format).toBe(UNIFIED_ARCHIVE_FORMAT)
      expect(manifest.formatVersion).toBe(UNIFIED_ARCHIVE_FORMAT_VERSION)
      expect(manifest.appVersion).toBe(APP_VERSION)
      expect(manifest.exportedAt).toBe(EXPORTED_AT.toISOString())
      expect(manifest.exportedByUserId).toBe(fixture.examA.user.id)
      // 空の表（Coursework: []）は載せず、採点の範囲と答案の有無は既定値を明示して書く
      expect(manifest.selection).toEqual({
        roots: {
          Exam: [fixture.examA.exam.id],
          AsbDefinition: [fileFixture.asbDefinitionId],
        },
        shared: {},
        scoring: { kind: "all" },
        includeAnswers: true,
        optionalItems: [],
      })
      expect(manifest.exclusions).toEqual({
        requested: {},
        excludedRowCounts: {},
      })

      const actualRowCounts = withDatabase(
        extracted.databasePath,
        countApplicationRows
      )
      expect(manifest.rowCounts).toEqual(actualRowCounts)
      expect(manifest.rowCounts).not.toHaveProperty("_prisma_migrations")
      expect(
        Object.values(manifest.rowCounts).every((rowCount) => rowCount > 0)
      ).toBe(true)
      // 範囲に入らない表は 0 なので載らない
      expect(manifest.rowCounts).not.toHaveProperty("Grade")
      expect(manifest.rowCounts).not.toHaveProperty("Coursework")

      expect(manifest.files).toEqual({
        count: allImagePaths().length,
        missing: [],
      })
      expect(manifest.files.count).toBe(extracted.fileContentsByPath.size)
    })

    it("書き出した利用者が無ければ exportedByUserId は null", async () => {
      const { manifest } = await exportArchive(
        { roots: { Exam: [fixture.examA.exam.id] } },
        { exportedByUserId: null }
      )

      expect(manifest.exportedByUserId).toBeNull()
    })

    it("利用者が外したもの・外した件数・本人分の採点・選んだ項目が残る", async () => {
      const selection: ArchiveSelection = {
        roots: { Grade: [fixture.gradeId] },
        exclusions: { Grade: [fixture.comparedGradeId] },
        scoring: { kind: "self", userId: fixture.examA.user.id },
        optionalItems: ["userSettings"],
      }
      const expectedScope = withDatabase(TEST_DB_PATH, (db) =>
        resolveArchiveScope(loadScopeRows(db), selection)
      )

      const { manifest } = await exportArchive(selection)

      expect(manifest.selection.scoring).toEqual({
        kind: "self",
        userId: fixture.examA.user.id,
      })
      expect(manifest.selection.includeAnswers).toBe(true)
      expect(manifest.selection.optionalItems).toEqual(["userSettings"])
      expect(manifest.exclusions.requested).toEqual({
        Grade: [fixture.comparedGradeId],
      })
      expect(manifest.exclusions.excludedRowCounts).toEqual(
        expectedScope.excludedRowCounts
      )
      expect(manifest.exclusions.excludedRowCounts).toMatchObject({
        Grade: 1,
        GradeItem: 1,
        GradeComparison: 1,
        QuestionScore: 1,
        ScoreDecision: 1,
      })
      expect(extractArchive(OUTPUT_PATH).manifestJson).toEqual(manifest)
    })

    it("lastMigration は、archive.db の _prisma_migrations で適用済み（完了・取り消しでない）の最新の名前", async () => {
      const sourcePath = copyTestDatabase("source-with-migrations.db")
      modifyDatabase(sourcePath, (db) => {
        db.exec(`DROP TABLE IF EXISTS "_prisma_migrations"`)
        db.exec(`
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
        const insertMigration = db.prepare<
          [string, string, string | null, string | null]
        >(
          `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, rolled_back_at, applied_steps_count)
           VALUES (?, 'checksum', ?, ?, ?, 1)`
        )
        // 適用済みの最新より後ろの名前に、未完了と取り消しを置く（それらを数えると答えが変わる）
        insertMigration.run(
          "migration-2",
          "20260201000000_applied_second",
          "2026-02-01T00:00:00.000Z",
          null
        )
        insertMigration.run(
          "migration-1",
          "20260101000000_applied_first",
          "2026-01-01T00:00:00.000Z",
          null
        )
        insertMigration.run(
          "migration-3",
          "20260301000000_unfinished",
          null,
          null
        )
        insertMigration.run(
          "migration-4",
          "20260401000000_rolled_back",
          "2026-04-01T00:00:00.000Z",
          "2026-04-02T00:00:00.000Z"
        )
      })

      const { manifest } = await exportArchive(
        { roots: { Exam: [fixture.examA.exam.id] } },
        { sourceDatabasePath: sourcePath }
      )

      expect(manifest.lastMigration).toBe("20260201000000_applied_second")
      expect(manifest.rowCounts).not.toHaveProperty("_prisma_migrations")
      const migrationTables = withDatabase(
        extractArchive(OUTPUT_PATH).databasePath,
        (db) =>
          db
            .prepare<[], { name: string }>(
              "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_prisma_migrations'"
            )
            .all()
      )
      expect(migrationTables).toHaveLength(1)
    })

    it("_prisma_migrations が無ければ lastMigration は null", async () => {
      const sourcePath = copyTestDatabase("source-without-migrations.db")
      modifyDatabase(sourcePath, (db) => {
        db.exec(`DROP TABLE IF EXISTS "_prisma_migrations"`)
      })

      const { manifest } = await exportArchive(
        { roots: { Exam: [fixture.examA.exam.id] } },
        { sourceDatabasePath: sourcePath }
      )

      expect(manifest.lastMigration).toBeNull()
    })
  })

  describe("欠けた画像", () => {
    it("データディレクトリに無い画像は notFound で残り、書き出しは成功し、ZIP には入らない", async () => {
      const missingPath = fileFixture.studentAnswerImagePaths[0]
      fs.rmSync(path.join(DATA_DIR, ...missingPath.split("/")))

      const { manifest } = await exportArchive({
        roots: { Exam: [fixture.examA.exam.id] },
      })

      expect(manifest.files.missing).toEqual([
        { path: missingPath, reason: "notFound" },
      ])
      expect(manifest.files.count).toBe(examAImagePaths().length - 1)
      const extracted = extractArchive(OUTPUT_PATH)
      expect([...extracted.fileContentsByPath.keys()].sort()).toEqual(
        examAImagePaths().filter((imagePath) => imagePath !== missingPath)
      )
      // 行は落とさない（画像が欠けても答案の行は残る）
      expect(
        withDatabase(extracted.databasePath, imagePathsInDatabase)
      ).toContain(missingPath)
    })

    it("絶対パスや .. でデータディレクトリの外へ出るパスは outsideDataDirectory で残り、ZIP には入らない", async () => {
      // 外のファイルは実在させる（notFound ではなく、外へ出ることで弾かれるのを見る）
      const absolutePath = path.join(WORK_DIR, "outside-absolute.png")
      fs.writeFileSync(absolutePath, "outside")
      fs.writeFileSync(path.join(WORK_DIR, "outside-relative.png"), "outside")
      const parentRelativePath = "../outside-relative.png"
      const nestedEscapePath = `exams/${fixture.examA.exam.id}/../../../outside-relative.png`

      const sourcePath = copyTestDatabase("source-with-outside-paths.db")
      modifyDatabase(sourcePath, (db) => {
        const updatePageImagePath = db.prepare<[string, string]>(
          `UPDATE "ExamPage" SET imagePath = ? WHERE id = ?`
        )
        updatePageImagePath.run(absolutePath, fixture.examA.pages[0].id)
        updatePageImagePath.run(parentRelativePath, fixture.examA.pages[1].id)
        db.prepare<[string, string]>(
          `UPDATE "StudentAnswerImage" SET imagePath = ? WHERE imagePath = ?`
        ).run(nestedEscapePath, fileFixture.studentAnswerImagePaths[0])
      })

      const { manifest } = await exportArchive(
        { roots: { Exam: [fixture.examA.exam.id] } },
        { sourceDatabasePath: sourcePath }
      )

      const byPath = (
        left: { path: string },
        right: { path: string }
      ): number => left.path.localeCompare(right.path)
      expect([...manifest.files.missing].sort(byPath)).toEqual(
        [
          { path: absolutePath, reason: "outsideDataDirectory" },
          { path: parentRelativePath, reason: "outsideDataDirectory" },
          { path: nestedEscapePath, reason: "outsideDataDirectory" },
        ].sort(byPath)
      )
      const extracted = extractArchive(OUTPUT_PATH)
      expect(
        extracted.entryNames.filter(
          (entryName) =>
            entryName.includes("outside") || entryName.includes("..")
        )
      ).toEqual([])
      const expectedPackedPaths = examAImagePaths().filter(
        (imagePath) =>
          imagePath !== fileFixture.examPageImagePaths[0] &&
          imagePath !== fileFixture.examPageImagePaths[1] &&
          imagePath !== fileFixture.studentAnswerImagePaths[0]
      )
      expect([...extracted.fileContentsByPath.keys()].sort()).toEqual(
        expectedPackedPaths
      )
      expect(manifest.files.count).toBe(expectedPackedPaths.length)
    })
  })

  describe("失敗するとき", () => {
    it("出力先が既にあれば失敗し、既存のファイルは変わらない", async () => {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true })
      fs.writeFileSync(OUTPUT_PATH, "既存のファイル")

      await expect(
        exportArchive({ roots: { Exam: [fixture.examA.exam.id] } })
      ).rejects.toThrow()

      expect(fs.readFileSync(OUTPUT_PATH, "utf8")).toBe("既存のファイル")
    })

    it("成績算出が使う試験を外すと ArchiveScopeError になり、出力ファイルは残らない", async () => {
      await expect(
        exportArchive({
          roots: { Grade: [fixture.gradeId] },
          exclusions: { Exam: [fixture.examA.exam.id] },
        })
      ).rejects.toBeInstanceOf(ArchiveScopeError)

      expect(fs.existsSync(OUTPUT_PATH)).toBe(false)
    })
  })

  describe("根の組み合わせ", () => {
    interface RootCombination {
      name: string
      selectionOf: () => ArchiveSelection
      presentTables: string[]
      absentTables: string[]
      imagePathsOf: () => string[]
    }

    const combinations: RootCombination[] = [
      {
        name: "試験だけ",
        selectionOf: () => ({ roots: { Exam: [fixture.examA.exam.id] } }),
        presentTables: ["Exam", "ExamPage", "StudentAnswerImage"],
        absentTables: ["Grade", "Coursework", "AsbDefinition"],
        imagePathsOf: () => examAImagePaths(),
      },
      {
        name: "資料だけ",
        selectionOf: () => ({ roots: { Coursework: [fixture.courseworkId] } }),
        presentTables: ["Coursework", "CourseworkItem", "CourseworkStudent"],
        absentTables: ["Exam", "Grade", "AsbDefinition"],
        imagePathsOf: () => [],
      },
      {
        name: "成績算出（使う試験と資料を引き込む）",
        selectionOf: () => ({ roots: { Grade: [fixture.gradeId] } }),
        presentTables: ["Grade", "GradeDataSource", "Exam", "Coursework"],
        absentTables: ["AsbDefinition"],
        imagePathsOf: () => examAImagePaths(),
      },
      {
        name: "解答用紙の定義",
        selectionOf: () => ({
          roots: { AsbDefinition: [fileFixture.asbDefinitionId] },
        }),
        presentTables: [
          "AsbDefinition",
          "AsbMajorQuestion",
          "AsbSubQuestion",
          "AsbImageElement",
          "User",
        ],
        absentTables: ["Exam", "Grade", "Coursework"],
        imagePathsOf: () => fileFixture.asbImagePaths,
      },
      {
        name: "共通の実体だけ（生徒）",
        selectionOf: () => ({
          roots: {},
          shared: { Student: [fixture.examA.students[0].id] },
        }),
        presentTables: ["Student"],
        absentTables: ["Exam", "Grade", "Coursework", "AsbDefinition"],
        imagePathsOf: () => [],
      },
      {
        name: "全部まとめて",
        selectionOf: () => ({
          roots: {
            Exam: [fixture.examA.exam.id, fixture.examB.exam.id],
            Coursework: [fixture.courseworkId],
            Grade: [fixture.gradeId],
            AsbDefinition: [fileFixture.asbDefinitionId],
          },
          shared: { Student: [fixture.examB.students[0].id] },
        }),
        presentTables: [
          "Exam",
          "Coursework",
          "Grade",
          "AsbDefinition",
          "AsbImageElement",
          "Student",
        ],
        absentTables: [],
        imagePathsOf: () => allImagePaths(),
      },
    ]

    it.each(combinations)(
      "$name を書き出せて、外部キーが閉じている",
      async ({ selectionOf, presentTables, absentTables, imagePathsOf }) => {
        const selection = selectionOf()
        const { manifest } = await exportArchive(selection)

        const extracted = extractArchive(OUTPUT_PATH)
        withDatabase(extracted.databasePath, (db) => {
          expect(db.pragma("foreign_key_check")).toEqual([])
          expect(manifest.rowCounts).toEqual(countApplicationRows(db))
          expect(imagePathsInDatabase(db)).toEqual(imagePathsOf())
        })
        for (const table of presentTables) {
          expect(manifest.rowCounts[table], table).toBeGreaterThan(0)
        }
        for (const table of absentTables) {
          expect(manifest.rowCounts, table).not.toHaveProperty(table)
        }
        expect([...extracted.fileContentsByPath.keys()].sort()).toEqual(
          imagePathsOf()
        )
        expect(manifest.selection.roots).toEqual(
          Object.fromEntries(
            Object.entries(selection.roots).filter(
              ([, ids]) => ids !== undefined && ids.length > 0
            )
          )
        )
        expect(manifest.selection.shared).toEqual(selection.shared ?? {})
      }
    )
  })

  it("進み具合が resolvingScope → writingDatabase → packing の順で知らされる", async () => {
    const phases: UnifiedArchiveExportPhase[] = []

    await exportArchive(
      { roots: { Exam: [fixture.examA.exam.id] } },
      { onProgress: (phase) => phases.push(phase) }
    )

    expect(phases).toEqual(["resolvingScope", "writingDatabase", "packing"])
  })
})
