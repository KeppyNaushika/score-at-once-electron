/**
 * 20260731000200_normalize_exam_export_settings のデータ移行テスト
 *
 * 検証すること:
 * - 重ね描きのスタイル4種が settingsJson から復元される（anchor は既存の見た目を保つ値）
 * - 後方互換キー（summaryScore / scorePosition 系）からのフォールバックが効く
 * - 採点状態ごとの可視性7行が復元される
 * - 平均・順位に詰め込まれていた2ビットが、種別×母集団の8行へ展開される
 * - settingsJson が壊れている行は黙って落とさず AuditLog に記録される
 *
 * 手順は「本マイグレーションの1つ手前まで適用 → 旧形状のデータを投入 →
 * 本マイグレーションだけを適用」。全マイグレーションを一括適用すると
 * 旧形状の ExamExportSettings を差し込む隙が無くなるため、ここだけ手で刻む。
 */
import Database from "better-sqlite3"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createBaseline } from "../../electron-src/lib/prisma/schema/baselineMigrations"
import { bootstrapSchema } from "../../electron-src/lib/prisma/schema/schemaBootstrap"
import { createPrismaClientForPath } from "../helpers/testPrismaClient"

const TEST_ROOT = path.join(os.tmpdir(), "normalize-exam-export-settings")
const DB_PATH = path.join(TEST_ROOT, "database.db")
const MIGRATIONS_DIR = path.resolve(__dirname, "../../prisma/migrations")
const TARGET_MIGRATION = "20260731000200_normalize_exam_export_settings"

vi.mock("../../electron-src/lib/prisma/databaseInitializer", () => ({
  getDatabasePath: () => DB_PATH,
}))

type SqliteDatabase = InstanceType<typeof Database>

const withDatabase = <T>(operation: (db: SqliteDatabase) => T): T => {
  const db = new Database(DB_PATH)
  try {
    return operation(db)
  } finally {
    db.close()
  }
}

const migrationNames = (): string[] =>
  fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

const applyMigration = (db: SqliteDatabase, name: string): void => {
  db.exec(
    fs.readFileSync(path.join(MIGRATIONS_DIR, name, "migration.sql"), "utf-8")
  )
}

async function buildDatabaseBeforeTargetMigration(): Promise<void> {
  bootstrapSchema(DB_PATH)
  const prisma = createPrismaClientForPath(DB_PATH)
  try {
    await createBaseline(prisma)
  } finally {
    await prisma.$disconnect()
  }

  const names = migrationNames()
  const targetIndex = names.indexOf(TARGET_MIGRATION)
  expect(targetIndex).toBeGreaterThan(0)

  withDatabase((db) => {
    for (const name of names.slice(0, targetIndex)) {
      if (name === "20260322232329_init") continue
      applyMigration(db, name)
    }
  })
}

const ISO = "2026-07-01T00:00:00.000+00:00"

/** 新形式のキーで一通り埋めた設定 */
const MODERN_SETTINGS = {
  scoringMarkConfig: {
    markPosition: "bottom-right",
    markOffsetX: 3,
    markOffsetY: -4,
    markSize: 80,
    markColor: "#123456",
    markOpacity: 60,
    partialScore: {
      position: "top-left",
      offsetX: 1,
      offsetY: 2,
      size: 20,
      color: "#abcdef",
      opacity: 70,
    },
    subtotalScore: {
      position: "middle-left",
      offsetX: 0,
      offsetY: 0,
      size: 22,
      color: "#111111",
      opacity: 80,
    },
    totalScore: {
      position: "middle-right",
      offsetX: 0,
      offsetY: 0,
      size: 24,
      color: "#222222",
      opacity: 90,
    },
    showMarkForStatus: { correct: false },
    showScoreForStatus: { unscored: true },
  },
  individualReportOptions: {
    showAverage: "class",
    showDeviation: false,
    showRank: true,
    rankType: "overall",
    graphOptions: { showBoxPlot: false, showOverallBoxPlot: true },
    boxPlotSubtotalGroupSelection: { enabled: true },
  },
}

/** 小計・合計を summaryScore で、部分点を scorePosition 系で持つ旧形式 */
const LEGACY_SETTINGS = {
  scoringMarkConfig: {
    scorePosition: "bottom-center",
    scoreOffsetX: 7,
    scoreOffsetY: 8,
    scoreSize: 15,
    summaryScore: {
      position: "top-right",
      offsetX: 5,
      offsetY: 6,
      size: 26,
      color: "#999999",
      opacity: 40,
    },
  },
  individualReportOptions: {},
}

function seedLegacyData(db: SqliteDatabase): void {
  const run = (sql: string, params: unknown[]) => db.prepare(sql).run(params)

  const exams: [string, string, unknown][] = [
    ["exam-modern", "現行形式", MODERN_SETTINGS],
    ["exam-legacy", "旧形式", LEGACY_SETTINGS],
    ["exam-broken", "壊れたJSON", null],
  ]

  for (const [examId, examName, settings] of exams) {
    run(
      `INSERT INTO "Exam" (id, examName, description, createdAt, updatedAt)
       VALUES (?,?,?,?,?)`,
      [examId, examName, null, ISO, ISO]
    )
    run(
      `INSERT INTO "ExamExportSettings" (id, examId, settingsJson, createdAt, updatedAt)
       VALUES (?,?,?,?,?)`,
      [
        `settings-${examId}`,
        examId,
        settings === null ? "{壊れている" : JSON.stringify(settings),
        ISO,
        ISO,
      ]
    )
  }
}

describe("20260731000200_normalize_exam_export_settings", () => {
  beforeEach(async () => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true })
    fs.mkdirSync(TEST_ROOT, { recursive: true })
    await buildDatabaseBeforeTargetMigration()
    withDatabase((db) => {
      seedLegacyData(db)
      applyMigration(db, TARGET_MIGRATION)
    })
  })

  afterEach(() => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true })
  })

  const styleOf = (examId: string, overlayKind: string) =>
    withDatabase((db) =>
      db
        .prepare(
          `SELECT position, anchor, offsetX, offsetY, size, color, opacity
           FROM "ExamAnswerOverlayStyle" WHERE examId = ? AND overlayKind = ?`
        )
        .get(examId, overlayKind)
    )

  it("採点マークは position と anchor が同値で移り、既存の見た目を保つ", () => {
    expect(styleOf("exam-modern", "mark")).toEqual({
      position: "bottom-right",
      anchor: "bottom-right",
      offsetX: 3,
      offsetY: -4,
      size: 80,
      color: "#123456",
      opacity: 60,
    })
  })

  it("点数は anchor が中央になる（旧描画が textAlign/textBaseline を中央固定していたため）", () => {
    const partial = styleOf("exam-modern", "partial") as { anchor: string }
    expect(partial.anchor).toBe("middle-center")
    expect(styleOf("exam-modern", "subtotal")).toMatchObject({
      position: "middle-left",
      size: 22,
    })
    expect(styleOf("exam-modern", "total")).toMatchObject({
      position: "middle-right",
      size: 24,
    })
  })

  it("後方互換キーからフォールバックする", () => {
    // 部分点は scorePosition 系から
    expect(styleOf("exam-legacy", "partial")).toMatchObject({
      position: "bottom-center",
      offsetX: 7,
      offsetY: 8,
      size: 15,
    })
    // 小計・合計は summaryScore から（既定色は種別ごとに異なる）
    expect(styleOf("exam-legacy", "subtotal")).toMatchObject({
      position: "top-right",
      size: 26,
      color: "#999999",
    })
    expect(styleOf("exam-legacy", "total")).toMatchObject({
      position: "top-right",
      size: 26,
      color: "#999999",
    })
  })

  it("採点状態ごとの可視性が7行そろい、保存値が優先される", () => {
    const rows = withDatabase((db) =>
      db
        .prepare(
          `SELECT status, showMark, showScore FROM "ExamAnswerOverlayVisibility"
           WHERE examId = ? ORDER BY status`
        )
        .all("exam-modern")
    ) as { status: string; showMark: number; showScore: number }[]

    expect(rows).toHaveLength(7)
    const byStatus = new Map(rows.map((row) => [row.status, row]))
    // 保存値が既定を上書きする
    expect(byStatus.get("correct")?.showMark).toBe(0)
    expect(byStatus.get("unscored")?.showScore).toBe(1)
    // 保存されていない状態は既定へ落ちる
    expect(byStatus.get("partial")?.showMark).toBe(1)
    expect(byStatus.get("unscored")?.showMark).toBe(0)
  })

  it("平均と順位に詰め込まれていた2ビットが種別×母集団の8行へ展開される", () => {
    const rows = withDatabase((db) =>
      db
        .prepare(
          `SELECT statisticKind, scope, shown FROM "ExamIndividualReportStatisticVisibility"
           WHERE examId = ? ORDER BY statisticKind, scope`
        )
        .all("exam-modern")
    ) as { statisticKind: string; scope: string; shown: number }[]

    expect(rows).toHaveLength(8)
    const cell = (statisticKind: string, scope: string) =>
      rows.find(
        (row) => row.statisticKind === statisticKind && row.scope === scope
      )?.shown

    // showAverage: "class" → 学級のみ
    expect(cell("average", "classroom")).toBe(1)
    expect(cell("average", "overall")).toBe(0)
    // showDeviation: false
    expect(cell("deviation", "overall")).toBe(0)
    // showRank: true ＋ rankType: "overall" → 全体のみ
    expect(cell("rank", "classroom")).toBe(0)
    expect(cell("rank", "overall")).toBe(1)
    // graphOptions.showBoxPlot: false
    expect(cell("boxPlot", "overall")).toBe(0)
    // 旧形式に無かったセルは false で始まる
    expect(cell("deviation", "classroom")).toBe(0)
    expect(cell("boxPlot", "classroom")).toBe(0)
  })

  it("グラフ設定は合計点の箱ひげとグループ絞り込みを引き継ぐ", () => {
    const graph = withDatabase((db) =>
      db
        .prepare(
          `SELECT showTotalScoreBoxPlot, boxPlotGroupSelectionEnabled
           FROM "ExamIndividualReportGraphSettings" WHERE examId = ?`
        )
        .get("exam-modern")
    ) as {
      showTotalScoreBoxPlot: number
      boxPlotGroupSelectionEnabled: number
    }
    expect(graph.showTotalScoreBoxPlot).toBe(1)
    expect(graph.boxPlotGroupSelectionEnabled).toBe(1)
  })

  it("壊れたJSONの行は黙って落とさず AuditLog に記録する", () => {
    const styles = withDatabase((db) =>
      db
        .prepare(
          `SELECT COUNT(*) AS count FROM "ExamAnswerOverlayStyle" WHERE examId = ?`
        )
        .get("exam-broken")
    ) as { count: number }
    expect(styles.count).toBe(0)

    const audit = withDatabase((db) =>
      db
        .prepare(
          `SELECT action, category, entityId FROM "AuditLog"
           WHERE action = 'exam.export_settings.migrate_failed'`
        )
        .all()
    ) as { action: string; category: string; entityId: string }[]
    expect(audit).toHaveLength(1)
    expect(audit[0].category).toBe("exam")
    expect(audit[0].entityId).toBe("exam-broken")
  })

  it("旧テーブルは削除される", () => {
    const tables = withDatabase((db) =>
      db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='table' AND name='ExamExportSettings'`
        )
        .all()
    )
    expect(tables).toHaveLength(0)
  })
})
