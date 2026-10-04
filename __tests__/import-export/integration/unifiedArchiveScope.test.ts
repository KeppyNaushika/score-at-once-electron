/**
 * 統合アーカイブ（.sao）の範囲の規則と、中身の DB の書き出し
 *
 * テスト対象:
 *   electron-src/lib/export/unified-archive/archiveScopeResolver.ts
 *   electron-src/lib/export/unified-archive/archiveDatabaseWriter.ts
 *
 * 規則は docs/unified-archive-design.md §5:
 * - 既定は関連するデータを全て含める（成績算出が使う試験・資料、比較先の成績算出、
 *   受験生の全期間の在籍とその学級、全員分の採点）
 * - 利用者が外したものは、それに従う行ごと外れ、外した件数が分かる
 * - 成績算出が使うものは外せない
 * - 書き出した DB の外部キーは閉じている
 */

import Database from "better-sqlite3"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { writeArchiveDatabase } from "../../../electron-src/lib/export/unified-archive/archiveDatabaseWriter"
import {
  ArchiveScopeError,
  type ArchiveSelection,
  loadScopeRows,
  resolveArchiveScope,
} from "../../../electron-src/lib/export/unified-archive/archiveScopeResolver"
import {
  cleanupTestDatabase,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../../helpers/testPrismaClient"
import {
  createUnifiedArchiveFixture,
  type UnifiedArchiveFixture,
} from "../../helpers/unifiedArchiveFixture"

const prisma = getTestPrismaClient()
const TEST_DB_PATH = path.resolve(__dirname, "../../../data/test-database.db")
const OUTPUT_DIR = path.join(os.tmpdir(), "unified-archive-scope")

const resolve = (selection: ArchiveSelection) => {
  const db = new Database(TEST_DB_PATH, { readonly: true })
  try {
    return resolveArchiveScope(loadScopeRows(db), selection)
  } finally {
    db.close()
  }
}

const idsOf = (
  scope: ReturnType<typeof resolve>,
  table: string
): ReadonlySet<string> => scope.rows.get(table) ?? new Set()

describe("統合アーカイブの範囲", () => {
  let fixture: UnifiedArchiveFixture

  beforeEach(async () => {
    await cleanupTestDatabase()
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true })
    fs.mkdirSync(OUTPUT_DIR, { recursive: true })
    fixture = await createUnifiedArchiveFixture(prisma)
  })

  afterAll(async () => {
    fs.rmSync(OUTPUT_DIR, { recursive: true, force: true })
    await disconnectTestPrisma()
  })

  it("試験を選ぶと、配下・受験生・全期間の在籍と学級・全員分の採点が入り、無関係な試験は入らない", () => {
    const scope = resolve({ roots: { Exam: [fixture.examA.exam.id] } })

    expect(idsOf(scope, "Exam")).toEqual(new Set([fixture.examA.exam.id]))
    expect(idsOf(scope, "CropRegion").size).toBe(
      fixture.examA.cropRegions.length
    )
    expect(idsOf(scope, "QuestionScore").has(fixture.otherScoreId)).toBe(true)
    expect(idsOf(scope, "ScoreDecision").has(fixture.scoreDecisionId)).toBe(
      true
    )
    expect(
      idsOf(scope, "StudentClassroomMembership").has(
        fixture.outsideMembershipId
      )
    ).toBe(true)
    expect(idsOf(scope, "Classroom").has(fixture.outsideClassroomId)).toBe(true)
    expect(idsOf(scope, "User").has(fixture.otherScorer.id)).toBe(true)
    // 試験Aを使う成績算出は、試験Aを選んだだけでは入らない（参照される側からは辿らない）
    expect(idsOf(scope, "Grade").size).toBe(0)
    expect(idsOf(scope, "Student").has(fixture.examB.students[0].id)).toBe(
      false
    )
    expect(scope.excludedRowCounts).toEqual({})
  })

  it("成績算出を選ぶと、使う試験・資料と比較先の成績算出が配下ごと入る", () => {
    const scope = resolve({ roots: { Grade: [fixture.gradeId] } })

    expect(idsOf(scope, "Grade")).toEqual(
      new Set([fixture.gradeId, fixture.comparedGradeId])
    )
    expect(idsOf(scope, "Exam")).toEqual(new Set([fixture.examA.exam.id]))
    expect(idsOf(scope, "QuestionScore").size).toBeGreaterThan(0)
    // 資料への参照は、DB の制約ではなく登録表から辿る（古い版の DB には制約が無い）
    expect(idsOf(scope, "Coursework")).toEqual(new Set([fixture.courseworkId]))
    expect(idsOf(scope, "CourseworkStudent").size).toBe(1)
    expect(idsOf(scope, "GradeComparison").has(fixture.comparisonId)).toBe(true)
  })

  it("比較先の成績算出を外すと、比較が外れ、外した件数が分かる", () => {
    const scope = resolve({
      roots: { Grade: [fixture.gradeId] },
      exclusions: { Grade: [fixture.comparedGradeId] },
    })

    expect(idsOf(scope, "Grade")).toEqual(new Set([fixture.gradeId]))
    expect(idsOf(scope, "GradeComparison").size).toBe(0)
    expect(scope.excludedRowCounts).toMatchObject({
      Grade: 1,
      GradeItem: 1,
      GradeComparison: 1,
    })
  })

  it("成績算出が使う試験は外せない", () => {
    expect(() =>
      resolve({
        roots: { Grade: [fixture.gradeId] },
        exclusions: { Exam: [fixture.examA.exam.id] },
      })
    ).toThrow(ArchiveScopeError)
  })

  it("本人分にすると、他の教員の採点・確定が外れる", () => {
    const scope = resolve({
      roots: { Exam: [fixture.examA.exam.id] },
      scoring: { kind: "self", userId: fixture.examA.user.id },
    })

    expect(idsOf(scope, "QuestionScore").has(fixture.otherScoreId)).toBe(false)
    expect(idsOf(scope, "QuestionScore").size).toBe(
      fixture.examA.questionScores.length
    )
    expect(idsOf(scope, "ScoreDecision").size).toBe(0)
    expect(idsOf(scope, "User").has(fixture.otherScorer.id)).toBe(false)
    expect(scope.excludedRowCounts).toMatchObject({
      QuestionScore: 1,
      ScoreDecision: 1,
      User: 1,
    })
  })

  it("採点と答案を外すと、受験生とその配下が外れ、試験の形は残る", () => {
    const scope = resolve({
      roots: { Exam: [fixture.examA.exam.id] },
      includeAnswers: false,
    })

    expect(idsOf(scope, "ExamStudent").size).toBe(0)
    expect(idsOf(scope, "QuestionScore").size).toBe(0)
    expect(idsOf(scope, "DrawingAnnotation").size).toBe(0)
    expect(idsOf(scope, "CropRegion").size).toBe(
      fixture.examA.cropRegions.length
    )
  })

  it("利用者個人の設定は、選んだときだけ、書き出しに入った利用者の分だけ入る", () => {
    const withoutSettings = resolve({
      roots: { Exam: [fixture.examA.exam.id] },
    })
    expect(idsOf(withoutSettings, "UserPreference").size).toBe(0)

    const withSettings = resolve({
      roots: { Exam: [fixture.examA.exam.id] },
      optionalItems: ["userSettings"],
    })
    expect(idsOf(withSettings, "UserPreference")).toEqual(
      new Set([fixture.preferenceIds.scorer])
    )
  })

  it("書き出した DB は範囲の行だけを持ち、外部キーが閉じている", () => {
    const scope = resolve({
      roots: { Grade: [fixture.gradeId] },
      exclusions: { Grade: [fixture.comparedGradeId] },
      scoring: { kind: "self", userId: fixture.examA.user.id },
    })
    const outputPath = path.join(OUTPUT_DIR, "archive.db")
    writeArchiveDatabase(TEST_DB_PATH, outputPath, scope)

    const archive = new Database(outputPath, { readonly: true })
    try {
      for (const [table, ids] of scope.rows) {
        const count = archive
          .prepare<[], { count: number }>(
            `SELECT COUNT(*) AS count FROM "${table}"`
          )
          .get()
        expect(count?.count, table).toBe(ids.size)
      }
      const examCount = archive
        .prepare<[], { count: number }>(`SELECT COUNT(*) AS count FROM "Exam"`)
        .get()
      expect(examCount?.count).toBe(1)
      expect(archive.pragma("foreign_key_check")).toEqual([])
    } finally {
      archive.close()
    }
  })

  it("同期のトリガー・内部表は書き出しに入らない", () => {
    const sourcePath = path.join(OUTPUT_DIR, "source.db")
    const seed = new Database(TEST_DB_PATH, { readonly: true })
    seed.prepare<[string]>("VACUUM INTO ?").run(sourcePath)
    seed.close()
    const source = new Database(sourcePath)
    source.exec(`CREATE TABLE "_sns_rows_Exam" (id TEXT PRIMARY KEY)`)
    source.exec(
      `CREATE TRIGGER "sns_exam_insert" AFTER INSERT ON "Exam" BEGIN INSERT INTO "_sns_rows_Exam" (id) VALUES (NEW.id); END`
    )
    source.close()

    const scope = resolve({ roots: { Exam: [fixture.examA.exam.id] } })
    const outputPath = path.join(OUTPUT_DIR, "archive.db")
    writeArchiveDatabase(sourcePath, outputPath, scope)

    const archive = new Database(outputPath, { readonly: true })
    try {
      const leftovers = archive
        .prepare<[], { name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'trigger' OR name LIKE '\\_sns%' ESCAPE '\\'"
        )
        .all()
      expect(leftovers).toEqual([])
    } finally {
      archive.close()
    }
  })
})
