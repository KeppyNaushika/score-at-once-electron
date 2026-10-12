/**
 * 統合アーカイブ（.sao）の範囲に入る、類型評価（docs/vlm-grading-design.md §4-8-3）。
 *
 * テスト対象: electron-src/lib/export/unified-archive/archiveTableRegistry.ts の ScoreScale の役割
 *
 * - 試験の類型評価（examId あり）は、設問が使っていなくても試験に従って入る
 * - 共通の類型評価（examId が null）は、入った設問が指しているものだけが引き上げられる
 * - 入った類型評価の類型は全部入り、ほかの試験の類型評価は入らない
 * - 採点行が指す類型からも、その類型評価が引き上げられる
 */

import Database from "better-sqlite3"
import * as path from "path"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import {
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

const resolveExam = (examId: string) => {
  const db = new Database(TEST_DB_PATH, { readonly: true })
  try {
    return resolveArchiveScope(loadScopeRows(db), {
      roots: { Exam: [examId] },
    })
  } finally {
    db.close()
  }
}

const createScale = (examId: string | null, name: string) =>
  prisma.scoreScale.create({
    data: {
      examId,
      name,
      levels: {
        create: [
          { label: "A", score: 10, sortOrder: 0 },
          { label: "B", score: 5, sortOrder: 1 },
        ],
      },
    },
    include: { levels: true },
  })

describe("統合アーカイブの範囲（類型評価）", () => {
  let fixture: UnifiedArchiveFixture

  beforeEach(async () => {
    await cleanupTestDatabase()
    fixture = await createUnifiedArchiveFixture(prisma)
  })

  afterAll(async () => {
    await disconnectTestPrisma()
  })

  it("試験のものは使っていなくても入り、共通のものは設問が指すものだけが入る", async () => {
    const examScale = await createScale(fixture.examA.exam.id, "試験Aのもの")
    const usedShared = await createScale(null, "使っている共通")
    const unusedShared = await createScale(null, "使っていない共通")
    const otherExamScale = await createScale(
      fixture.examB.exam.id,
      "試験Bのもの"
    )
    await prisma.cropRegion.update({
      where: { id: fixture.examA.cropRegions[0].id },
      data: { scoringMethod: "scale", scoreScaleId: usedShared.id },
    })

    const scope = resolveExam(fixture.examA.exam.id)
    const scaleIds = scope.rows.get("ScoreScale") ?? new Set()
    expect([...scaleIds].sort()).toEqual([examScale.id, usedShared.id].sort())
    expect(scaleIds.has(unusedShared.id)).toBe(false)
    expect(scaleIds.has(otherExamScale.id)).toBe(false)

    const levelIds = scope.rows.get("ScoreScaleLevel") ?? new Set()
    expect([...levelIds].sort()).toEqual(
      [...examScale.levels, ...usedShared.levels]
        .map((level) => level.id)
        .sort()
    )
  })

  it("採点行が指す類型から、その類型評価が引き上げられる", async () => {
    const shared = await createScale(null, "共通")
    await prisma.questionScore.create({
      data: {
        cropRegionId: fixture.examA.cropRegions[0].id,
        examStudentId: fixture.examA.examStudents[0].id,
        userId: fixture.examA.user.id,
        status: "evaluated",
        scaleLevelId: shared.levels[0].id,
      },
    })

    const scope = resolveExam(fixture.examA.exam.id)
    expect(scope.rows.get("ScoreScale")?.has(shared.id)).toBe(true)
    expect(scope.rows.get("ScoreScaleLevel")?.size).toBe(2)
  })
})
