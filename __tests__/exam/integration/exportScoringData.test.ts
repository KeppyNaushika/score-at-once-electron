/**
 * Excel 出力の採点データ（fetchExportData）統合テスト
 *
 * この経路を検証していたのは採番学級の引き当てだけ（exportPlacementKey.test.ts）で、
 * 得点・配点・小計にはどのテストも触れていなかった。実際に
 * `maxScore: region.points || 0` を `maxScore: 0` へ壊しても全テストが通る状態だったので、
 * 配点が全て 0 の成績表が配布されても CI は緑のままになる。
 *
 * ここでは「設問列の配点」「判定ごとの得点」「合計」「小計」「競合と確定の扱い」を固定する。
 * 解決ルール自体は resolveEffectiveScores のテストが持つので、ここは配線だけを見る。
 */

import * as path from "path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_DB_PATH = path.resolve(__dirname, "../../../data/test-database.db")

vi.mock("../../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import { fetchExportData } from "@/electron-src/lib/export/excel/dataFetcher"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

/** 受験者1名の設問スコアを、設問の並び順どおりの判定へ置き換える */
async function setScores(
  examStudentId: string,
  cropRegionIds: string[],
  verdicts: Array<{ status: string; partialScore: number | null }>
) {
  await testPrisma.questionScore.deleteMany({ where: { examStudentId } })
  const user = await testPrisma.user.findFirstOrThrow()
  for (const [index, cropRegionId] of cropRegionIds.entries()) {
    await testPrisma.questionScore.create({
      data: {
        id: crypto.randomUUID(),
        cropRegionId,
        examStudentId,
        userId: user.id,
        status: verdicts[index].status,
        partialScore: verdicts[index].partialScore,
      },
    })
  }
}

describe("Excel 出力の採点データ", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("設問列は orderIndex 順に並び、配点は領域の points がそのまま出る", async () => {
    const fixture = await createFullTestExam(testPrisma, {})
    const [examStudent] = fixture.examStudents

    const result = await fetchExportData(fixture.exam.id, [examStudent.id])

    expect(result.questionRegions).toHaveLength(fixture.cropRegions.length)
    expect(
      result.questionRegions.map((cropRegion) => cropRegion.label)
    ).toEqual(fixture.cropRegions.map((cropRegion) => cropRegion.label))

    const [scoringData] = result.scoringData
    // 配点が 0 に落ちると成績表の満点欄が全て 0 になる
    for (const [index, score] of scoringData.scores.entries()) {
      expect(score.maxScore).toBe(fixture.cropRegions[index].points)
      expect(score.questionId).toBe(fixture.cropRegions[index].id)
    }
  })

  it("判定ごとの得点と合計が配点から算出される", async () => {
    const fixture = await createFullTestExam(testPrisma, {})
    const [examStudent] = fixture.examStudents
    const cropRegionIds = fixture.cropRegions.map((cropRegion) => cropRegion.id)
    await setScores(examStudent.id, cropRegionIds, [
      { status: "correct", partialScore: null },
      { status: "incorrect", partialScore: null },
      { status: "partial", partialScore: 4 },
      { status: "unscored", partialScore: null },
    ])

    const result = await fetchExportData(fixture.exam.id, [examStudent.id])
    const [scoringData] = result.scoringData

    // 正答は満点、誤答は 0、部分点は入力値、未採点は null
    expect(scoringData.scores.map((score) => score.score)).toEqual([
      10,
      0,
      4,
      null,
    ])
    expect(scoringData.scores.map((score) => score.status)).toEqual([
      "correct",
      "incorrect",
      "partial",
      "unscored",
    ])
    expect(scoringData.totalScore).toBe(14)
    expect(scoringData.totalMaxScore).toBe(40)
  })

  it("全問未採点の受験者は合計点を出さない（0 点と区別する）", async () => {
    const fixture = await createFullTestExam(testPrisma, {})
    const [examStudent] = fixture.examStudents
    const cropRegionIds = fixture.cropRegions.map((cropRegion) => cropRegion.id)
    await setScores(
      examStudent.id,
      cropRegionIds,
      cropRegionIds.map(() => ({ status: "unscored", partialScore: null }))
    )

    const result = await fetchExportData(fixture.exam.id, [examStudent.id])
    const [scoringData] = result.scoringData

    expect(scoringData.totalScore).toBeNull()
    // 満点は採点状況に依らず設問の配点合計
    expect(scoringData.totalMaxScore).toBe(40)
  })

  it("小計は割り当てられた設問の得点と配点だけを集める", async () => {
    const fixture = await createFullTestExam(testPrisma, {})
    const [examStudent] = fixture.examStudents
    const cropRegionIds = fixture.cropRegions.map((cropRegion) => cropRegion.id)
    // ビルダーは設問を小計へ交互に割り当てる（前半=問1,問3 / 後半=問2,問4）
    await setScores(examStudent.id, cropRegionIds, [
      { status: "correct", partialScore: null },
      { status: "incorrect", partialScore: null },
      { status: "partial", partialScore: 4 },
      { status: "correct", partialScore: null },
    ])

    const result = await fetchExportData(fixture.exam.id, [examStudent.id])

    expect(result.subtotalColumns.map((column) => column.label)).toEqual([
      "前半",
      "後半",
    ])

    const [scoringData] = result.scoringData
    const [firstSubtotal, secondSubtotal] = fixture.subtotals
    const firstHalf = scoringData.subtotalScores.find(
      (subtotalScore) => subtotalScore.subtotalId === firstSubtotal.id
    )!
    const secondHalf = scoringData.subtotalScores.find(
      (subtotalScore) => subtotalScore.subtotalId === secondSubtotal.id
    )!

    expect(firstHalf.score).toBe(14) // 問1(10) + 問3(4)
    expect(firstHalf.maxScore).toBe(20)
    expect(secondHalf.score).toBe(10) // 問2(0) + 問4(10)
    expect(secondHalf.maxScore).toBe(20)
    expect(firstHalf.subtotalGroupName).toBe(fixture.subtotalGroup.name)
  })

  it("割り当てが無い小計は満点も点も出さない", async () => {
    const fixture = await createFullTestExam(testPrisma, {})
    const [examStudent] = fixture.examStudents
    await testPrisma.cropSubtotal.deleteMany({})

    const result = await fetchExportData(fixture.exam.id, [examStudent.id])
    const [scoringData] = result.scoringData

    for (const subtotalScore of scoringData.subtotalScores) {
      expect(subtotalScore.hasQuestionAssignments).toBe(false)
      expect(subtotalScore.score).toBeNull()
      expect(subtotalScore.maxScore).toBe(0)
    }
  })

  it("採点者間で食い違うセルは競合として報告し、点を出さない", async () => {
    const fixture = await createFullTestExam(testPrisma, {})
    const [examStudent] = fixture.examStudents
    const [firstCropRegion] = fixture.cropRegions

    const otherUser = await testPrisma.user.create({
      data: {
        id: crypto.randomUUID(),
        username: `other_${crypto.randomUUID()}`,
        name: "別の採点者",
        role: "teacher",
      },
    })
    await testPrisma.questionScore.create({
      data: {
        id: crypto.randomUUID(),
        cropRegionId: firstCropRegion.id,
        examStudentId: examStudent.id,
        userId: otherUser.id,
        status: "incorrect",
        partialScore: null,
      },
    })

    const result = await fetchExportData(fixture.exam.id, [examStudent.id])

    expect(result.scoreConflicts).toHaveLength(1)
    expect(result.scoreConflicts![0].cropRegionId).toBe(firstCropRegion.id)

    const [scoringData] = result.scoringData
    // 解決できないので値を出さない（未採点として書き出す）
    expect(scoringData.scores[0].score).toBeNull()
    expect(scoringData.scores[0].status).toBe("unscored")
  })

  it("確定（ScoreDecision）は採点者の提案より優先される", async () => {
    const fixture = await createFullTestExam(testPrisma, {})
    const [examStudent] = fixture.examStudents
    const [firstCropRegion] = fixture.cropRegions

    // 提案は正答（10点）。OWNER が部分点 3 点で確定する
    await testPrisma.scoreDecision.create({
      data: {
        id: crypto.randomUUID(),
        cropRegionId: firstCropRegion.id,
        examStudentId: examStudent.id,
        verdict: "partial",
        score: 3,
        decidedByUserId: fixture.user.id,
      },
    })

    const result = await fetchExportData(fixture.exam.id, [examStudent.id])
    const [scoringData] = result.scoringData

    expect(scoringData.scores[0].status).toBe("partial")
    expect(scoringData.scores[0].score).toBe(3)
  })
})
