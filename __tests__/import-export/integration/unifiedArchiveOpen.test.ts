/**
 * 統合アーカイブ（.sao）を開くときの守りと現行化（docs/unified-archive-design.md §4.1・§7.1 の1）
 *
 * テスト DB（data/test-database.db）は使わない。archive.db の材料は固定データ
 * （`__tests__/fixtures/unifiedArchiveBaseline.sql`。古い版の合成データ）と、それに全 migration を
 * 当てた現行の DB（表・列を比べる相手にもする）。ZIP はテストの中で adm-zip で組む。
 */

import AdmZip from "adm-zip"
import Database from "better-sqlite3"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"

import { ARCHIVE_TABLES } from "../../../electron-src/lib/export/unified-archive/archiveTableRegistry"
import {
  openUnifiedArchive,
  UnifiedArchiveOpenError,
  type UnifiedArchiveOpenErrorKind,
} from "../../../electron-src/lib/import/unified-archive/archiveOpener"
import {
  applyMigrationSql,
  recordAppliedMigration,
} from "../../../electron-src/lib/prisma/schema/migrationApplier"
import {
  UNIFIED_ARCHIVE_FORMAT,
  UNIFIED_ARCHIVE_FORMAT_VERSION,
  type UnifiedArchiveManifest,
} from "../../../src/types/unifiedArchive.types"
import {
  createDatabaseFromDump,
  pendingMigrations,
} from "../../helpers/migrationCommutation"

const ROOT_DIR = path.join(os.tmpdir(), "unified-archive-open-test")
const BASELINE_SQL = fs.readFileSync(
  path.resolve(__dirname, "../../fixtures/unifiedArchiveBaseline.sql"),
  "utf-8"
)
const APP_MIGRATIONS_DIR = path.resolve(__dirname, "../../../prisma/migrations")

/** アプリの migration の後ろに、既存の行から一意制約つきの表へ行を作る1本を足した置き場 */
const SYNTHETIC_MIGRATIONS_DIR = path.join(ROOT_DIR, "migrations")
const SYNTHETIC_MIGRATION_NAME = "99999999999999_synthetic_overlay_rows"
const SYNTHETIC_MIGRATION_SQL = `INSERT INTO "ExamAnswerOverlayVisibility"
    ("id", "examId", "status", "showMark", "showScore", "createdAt", "updatedAt")
  SELECT lower(hex(randomblob(16))), "id", 'synthetic', 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  FROM "Exam";`

const OLD_DB_PATH = path.join(ROOT_DIR, "old.db")
/** アプリの migration を全部当てた DB */
const CURRENT_DB_PATH = path.join(ROOT_DIR, "current.db")
/** 足した1本まで当てた DB */
const SYNTHETIC_CURRENT_DB_PATH = path.join(ROOT_DIR, "synthetic-current.db")

let caseDir = ""
let caseCount = 0

type SqliteDatabase = InstanceType<typeof Database>

const migrateToLatest = (databasePath: string, migrationsDir: string) => {
  const db = new Database(databasePath)
  try {
    for (const migration of pendingMigrations(db, migrationsDir)) {
      applyMigrationSql(db, migration.sql)
      recordAppliedMigration(
        db,
        migration.name,
        migration.sql,
        new Date().toISOString()
      )
    }
  } finally {
    db.close()
  }
}

const appliedNamesOf = (databasePath: string): string[] => {
  const db = new Database(databasePath, { readonly: true })
  try {
    return db
      .prepare<[], { migration_name: string }>(
        `SELECT "migration_name" FROM "_prisma_migrations" ORDER BY "migration_name"`
      )
      .all()
      .map((row) => row.migration_name)
  } finally {
    db.close()
  }
}

const localNamesOf = (migrationsDir: string): string[] =>
  fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

const tableExists = (db: SqliteDatabase, table: string): boolean =>
  db
    .prepare<[string], { name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?"
    )
    .get(table) !== undefined

/** 登録表の表ごとの id（表が無ければ載せない） */
const idsByTableOf = (databasePath: string): Map<string, Set<string>> => {
  const db = new Database(databasePath, { readonly: true })
  try {
    const idsByTable = new Map<string, Set<string>>()
    for (const table of Object.keys(ARCHIVE_TABLES)) {
      if (!tableExists(db, table)) continue
      idsByTable.set(
        table,
        new Set(
          db
            .prepare<[], { id: string }>(`SELECT id FROM "${table}"`)
            .all()
            .map((row) => row.id)
        )
      )
    }
    return idsByTable
  } finally {
    db.close()
  }
}

const validManifest = (): UnifiedArchiveManifest => ({
  format: UNIFIED_ARCHIVE_FORMAT,
  formatVersion: UNIFIED_ARCHIVE_FORMAT_VERSION,
  appVersion: "0.0.0-test",
  lastMigration: null,
  exportedAt: "2026-10-04T00:00:00.000Z",
  exportedByUserId: null,
  selection: {
    roots: { Exam: ["exam-1"] },
    shared: {},
    scoring: { kind: "all" },
    includeAnswers: true,
    optionalItems: ["auditLog"],
  },
  exclusions: { requested: {}, excludedRowCounts: { QuestionScore: 3 } },
  rowCounts: { Exam: 1 },
  files: {
    count: 1,
    missing: [{ path: "exams/x/master-answers/a.png", reason: "notFound" }],
  },
})

interface ZipContents {
  manifest?: unknown
  /** 生の manifest.json（`manifest` より優先） */
  manifestText?: string
  databasePath?: string
  files?: Record<string, string>
  /** 追加する項目（名前はそのまま書く。adm-zip の正規化を通さない） */
  rawEntries?: Record<string, string>
}

/** テストごとの作業場所に ZIP を組み、パスを返す */
const buildArchive = (contents: ZipContents): string => {
  const zip = new AdmZip()
  if (contents.manifestText !== undefined) {
    zip.addFile("manifest.json", Buffer.from(contents.manifestText))
  } else if (contents.manifest !== undefined) {
    zip.addFile("manifest.json", Buffer.from(JSON.stringify(contents.manifest)))
  }
  if (contents.databasePath) {
    zip.addFile("archive.db", fs.readFileSync(contents.databasePath))
  }
  for (const [filePath, content] of Object.entries(contents.files ?? {})) {
    zip.addFile(`files/${filePath}`, Buffer.from(content))
  }
  for (const [entryName, content] of Object.entries(
    contents.rawEntries ?? {}
  )) {
    const entry = zip.addFile("placeholder", Buffer.from(content))
    entry.entryName = entryName
  }
  const archivePath = path.join(caseDir, "archive.sao")
  zip.writeZip(archivePath)
  return archivePath
}

/** 元の DB を写し、手を加えた archive.db を作る */
const databaseCopy = (
  sourcePath: string,
  modify?: (db: SqliteDatabase) => void
): string => {
  const copyPath = path.join(caseDir, `source-${caseCount++}.db`)
  fs.copyFileSync(sourcePath, copyPath)
  if (modify) {
    const db = new Database(copyPath)
    try {
      modify(db)
    } finally {
      db.close()
    }
  }
  return copyPath
}

const workDirectoryOf = () => path.join(caseDir, "work")

const open = (
  archivePath: string,
  overrides: { migrationsDir?: string; referenceDatabasePath?: string } = {}
) =>
  openUnifiedArchive({
    archivePath,
    workDirectory: workDirectoryOf(),
    migrationsDir: overrides.migrationsDir ?? APP_MIGRATIONS_DIR,
    referenceDatabasePath: overrides.referenceDatabasePath ?? CURRENT_DB_PATH,
  })

const openErrorOf = (
  archivePath: string,
  overrides: { migrationsDir?: string; referenceDatabasePath?: string } = {}
): UnifiedArchiveOpenError => {
  try {
    open(archivePath, overrides)
  } catch (error) {
    if (error instanceof UnifiedArchiveOpenError) return error
    throw error
  }
  throw new Error("開けてしまった")
}

const expectOpenError = (
  archivePath: string,
  kind: UnifiedArchiveOpenErrorKind,
  overrides: { migrationsDir?: string; referenceDatabasePath?: string } = {}
): UnifiedArchiveOpenError => {
  const error = openErrorOf(archivePath, overrides)
  expect(error.kind).toBe(kind)
  return error
}

beforeAll(() => {
  fs.rmSync(ROOT_DIR, { recursive: true, force: true })
  fs.mkdirSync(ROOT_DIR, { recursive: true })

  fs.cpSync(APP_MIGRATIONS_DIR, SYNTHETIC_MIGRATIONS_DIR, { recursive: true })
  fs.mkdirSync(path.join(SYNTHETIC_MIGRATIONS_DIR, SYNTHETIC_MIGRATION_NAME))
  fs.writeFileSync(
    path.join(
      SYNTHETIC_MIGRATIONS_DIR,
      SYNTHETIC_MIGRATION_NAME,
      "migration.sql"
    ),
    SYNTHETIC_MIGRATION_SQL
  )

  createDatabaseFromDump(OLD_DB_PATH, BASELINE_SQL)
  createDatabaseFromDump(CURRENT_DB_PATH, BASELINE_SQL)
  migrateToLatest(CURRENT_DB_PATH, APP_MIGRATIONS_DIR)
  createDatabaseFromDump(SYNTHETIC_CURRENT_DB_PATH, BASELINE_SQL)
  migrateToLatest(SYNTHETIC_CURRENT_DB_PATH, SYNTHETIC_MIGRATIONS_DIR)
})

afterAll(() => {
  fs.rmSync(ROOT_DIR, { recursive: true, force: true })
})

beforeEach((context) => {
  caseDir = path.join(ROOT_DIR, "cases", context.task.id)
  fs.mkdirSync(caseDir, { recursive: true })
})

describe("現行化", () => {
  it("古い版の archive.db に不足の migration を当て、現行化で生まれた行を控える", () => {
    const archivePath = buildArchive({
      manifest: validManifest(),
      databasePath: OLD_DB_PATH,
      files: { "exams/e1/master-answers/page-1.png": "png-bytes" },
    })
    const opened = open(archivePath, {
      migrationsDir: SYNTHETIC_MIGRATIONS_DIR,
      referenceDatabasePath: SYNTHETIC_CURRENT_DB_PATH,
    })

    const oldApplied = new Set(appliedNamesOf(OLD_DB_PATH))
    const expectedApplied = localNamesOf(SYNTHETIC_MIGRATIONS_DIR).filter(
      (name) => !oldApplied.has(name)
    )
    expect(expectedApplied).toContain(SYNTHETIC_MIGRATION_NAME)
    expect(opened.appliedMigrations).toEqual(expectedApplied)
    expect(appliedNamesOf(opened.databasePath)).toEqual(
      localNamesOf(SYNTHETIC_MIGRATIONS_DIR)
    )

    // 前後の id の差（独立に数え直す）と一致する
    const idsBefore = idsByTableOf(OLD_DB_PATH)
    const expectedMigrated: Record<string, string[]> = {}
    for (const [table, idsAfter] of idsByTableOf(opened.databasePath)) {
      const before = idsBefore.get(table) ?? new Set<string>()
      const created = [...idsAfter].filter((id) => !before.has(id)).sort()
      if (created.length > 0) expectedMigrated[table] = created
    }
    expect(opened.migratedRowIds).toEqual(expectedMigrated)
    expect(Object.keys(opened.migratedRowIds)).toEqual([
      "ExamAnswerOverlayVisibility",
    ])
    expect(opened.migratedRowIds.ExamAnswerOverlayVisibility).toHaveLength(2)

    expect(opened.manifest).toEqual(validManifest())
    expect(opened.filesDirectory).toBe(path.join(workDirectoryOf(), "files"))
    expect(
      fs.readFileSync(
        path.join(opened.filesDirectory, "exams/e1/master-answers/page-1.png"),
        "utf-8"
      )
    ).toBe("png-bytes")
  })

  it("アプリの migration だけなら、行は生まれない", () => {
    const opened = open(
      buildArchive({ manifest: validManifest(), databasePath: OLD_DB_PATH })
    )
    const oldApplied = new Set(appliedNamesOf(OLD_DB_PATH))
    expect(opened.appliedMigrations).toEqual(
      localNamesOf(APP_MIGRATIONS_DIR).filter((name) => !oldApplied.has(name))
    )
    expect(opened.migratedRowIds).toEqual({})
  })

  it("現行の archive.db なら何も当てない。files/ が無くても空のディレクトリを返す", () => {
    const opened = open(
      buildArchive({ manifest: validManifest(), databasePath: CURRENT_DB_PATH })
    )
    expect(opened.appliedMigrations).toEqual([])
    expect(opened.migratedRowIds).toEqual({})
    expect(fs.readdirSync(opened.filesDirectory)).toEqual([])
  })
})

describe("ZIP の守り", () => {
  it("ZIP でないファイルは notArchive", () => {
    const archivePath = path.join(caseDir, "not-zip.sao")
    fs.writeFileSync(archivePath, "これは ZIP ではない")
    expectOpenError(archivePath, "notArchive")
  })

  it("ZIP の外へ出る名前（zip slip）は notArchive で、何も書かない", () => {
    const archivePath = buildArchive({
      manifest: validManifest(),
      databasePath: CURRENT_DB_PATH,
      rawEntries: { "files/../../escaped.txt": "x" },
    })
    const error = expectOpenError(archivePath, "notArchive")
    expect(error.details.join()).toContain("escaped.txt")
    expect(fs.existsSync(path.join(caseDir, "escaped.txt"))).toBe(false)
    expect(fs.readdirSync(workDirectoryOf())).toEqual([])
  })

  it.each([
    ["絶対パス", "/files/absolute.txt"],
    ["「\\」を含む名前", "files\\backslash.txt"],
    ["想定外の項目", "extra.txt"],
  ])("%s は notArchive", (_label, entryName) => {
    const archivePath = buildArchive({
      manifest: validManifest(),
      databasePath: CURRENT_DB_PATH,
      rawEntries: { [entryName]: "x" },
    })
    expectOpenError(archivePath, "notArchive")
  })

  it("manifest.json が無ければ notArchive", () => {
    const archivePath = buildArchive({ databasePath: CURRENT_DB_PATH })
    const error = expectOpenError(archivePath, "notArchive")
    expect(error.details).toContain("manifest.json が無い")
  })

  it("archive.db が無ければ notArchive", () => {
    const archivePath = buildArchive({ manifest: validManifest() })
    const error = expectOpenError(archivePath, "notArchive")
    expect(error.details).toContain("archive.db が無い")
  })

  it("_prisma_migrations が無ければ notArchive", () => {
    const databasePath = databaseCopy(CURRENT_DB_PATH, (db) => {
      db.exec(`DROP TABLE "_prisma_migrations"`)
    })
    expectOpenError(
      buildArchive({ manifest: validManifest(), databasePath }),
      "notArchive"
    )
  })
})

describe("manifest の守り", () => {
  it("JSON として読めなければ invalidManifest", () => {
    expectOpenError(
      buildArchive({ manifestText: "{", databasePath: CURRENT_DB_PATH }),
      "invalidManifest"
    )
  })

  it("型の違う項目は invalidManifest で、どこが違うかを返す", () => {
    const manifest = {
      ...validManifest(),
      selection: { ...validManifest().selection, includeAnswers: "yes" },
      rowCounts: { Exam: -1 },
    }
    const error = expectOpenError(
      buildArchive({ manifest, databasePath: CURRENT_DB_PATH }),
      "invalidManifest"
    )
    expect(error.details).toEqual([
      "selection.includeAnswers: 真偽値ではありません",
      "rowCounts.Exam: 0 以上の整数ではありません",
    ])
  })

  it("format が違えば unsupportedFormat", () => {
    expectOpenError(
      buildArchive({
        manifest: { ...validManifest(), format: "something-else" },
        databasePath: CURRENT_DB_PATH,
      }),
      "unsupportedFormat"
    )
  })

  it("formatVersion がアプリの知る版より新しければ、形が違っても unsupportedFormat", () => {
    expectOpenError(
      buildArchive({
        manifest: {
          format: UNIFIED_ARCHIVE_FORMAT,
          formatVersion: UNIFIED_ARCHIVE_FORMAT_VERSION + 1,
        },
        databasePath: CURRENT_DB_PATH,
      }),
      "unsupportedFormat"
    )
  })
})

describe("DB の守り", () => {
  it("アプリの知らない migration が当たっていれば newerSchema", () => {
    const databasePath = databaseCopy(CURRENT_DB_PATH, (db) => {
      recordAppliedMigration(
        db,
        "99999999999999_from_the_future",
        "SELECT 1;",
        new Date().toISOString()
      )
    })
    const error = expectOpenError(
      buildArchive({ manifest: validManifest(), databasePath }),
      "newerSchema"
    )
    expect(error.details).toEqual(["99999999999999_from_the_future"])
  })

  it("アプリの最新より古い未知の名前（改名前の migration の適用記録）は通す", () => {
    const databasePath = databaseCopy(CURRENT_DB_PATH, (db) => {
      recordAppliedMigration(
        db,
        "20260725140000_drop_crop_region_marking_override",
        "SELECT 1;",
        new Date().toISOString()
      )
    })
    const opened = open(
      buildArchive({ manifest: validManifest(), databasePath })
    )
    expect(opened.appliedMigrations).toEqual([])
  })

  it("トリガー入りは unsafeSchema", () => {
    const databasePath = databaseCopy(CURRENT_DB_PATH, (db) => {
      db.exec(`CREATE TRIGGER "evil" AFTER INSERT ON "Exam" BEGIN
        DELETE FROM "Student"; END`)
    })
    const error = expectOpenError(
      buildArchive({ manifest: validManifest(), databasePath }),
      "unsafeSchema"
    )
    expect(error.details).toEqual(["trigger evil"])
  })

  it("ビュー入りは unsafeSchema", () => {
    const databasePath = databaseCopy(CURRENT_DB_PATH, (db) => {
      db.exec(`CREATE VIEW "peek" AS SELECT id FROM "Exam"`)
    })
    const error = expectOpenError(
      buildArchive({ manifest: validManifest(), databasePath }),
      "unsafeSchema"
    )
    expect(error.details).toEqual(["view peek"])
  })

  it("ファイルの途中を書き換えた DB は corrupt", () => {
    const databasePath = databaseCopy(CURRENT_DB_PATH)
    const bytes = fs.readFileSync(databasePath)
    const pageSize = bytes.readUInt16BE(16)
    const middlePage = Math.floor(bytes.length / pageSize / 2)
    // ヘッダー（1ページ目）は残し、中ほどの数ページを壊す
    bytes.fill(0xa5, middlePage * pageSize, (middlePage + 4) * pageSize)
    fs.writeFileSync(databasePath, bytes)
    expectOpenError(
      buildArchive({ manifest: validManifest(), databasePath }),
      "corrupt"
    )
  })

  it("取り込み先と列が違えば schemaMismatch", () => {
    const referenceDatabasePath = databaseCopy(CURRENT_DB_PATH, (db) => {
      db.exec(`ALTER TABLE "Exam" ADD COLUMN "futureColumn" TEXT`)
    })
    const error = expectOpenError(
      buildArchive({
        manifest: validManifest(),
        databasePath: CURRENT_DB_PATH,
      }),
      "schemaMismatch",
      { referenceDatabasePath }
    )
    expect(error.details).toEqual(["列 Exam.futureColumn がアーカイブに無い"])
  })

  it("外部キーが閉じていなければ schemaMismatch", () => {
    const databasePath = databaseCopy(CURRENT_DB_PATH, (db) => {
      // better-sqlite3 は既定で外部キーを検査するので、壊れた行を作るために切る
      db.pragma("foreign_keys = OFF")
      db.exec(`INSERT INTO "ExamAnswerOverlayVisibility"
        ("id", "examId", "status", "showMark", "showScore", "createdAt", "updatedAt")
        VALUES ('orphan', 'no-such-exam', 'x', 1, 1, '2026-10-04T00:00:00.000Z', '2026-10-04T00:00:00.000Z')`)
    })
    const error = expectOpenError(
      buildArchive({ manifest: validManifest(), databasePath }),
      "schemaMismatch"
    )
    expect(error.details).toEqual([
      "外部キーの違反 ExamAnswerOverlayVisibility → Exam: 1件",
    ])
  })
})
