/**
 * 類型評価の点を読む所（docs/vlm-grading-design.md §4-8-4・§4-8-7 の S3）。
 *
 * 点は保存せず、読むときに付けた類型の点数から引く。読む所はどれも採点行に類型を同梱し、
 * 単一実装（calculateActualScore）へ設問の方式と一緒に渡す。
 *
 * - Excel 出力の設問の点・合計・小計が類型の点数になり、配点を超えてよい
 * - 方式と合わない採点（類型評価の設問の正答、点の採点の設問の評価済み）は未採点と同じに読む
 * - 採点者の類型が違えば食い違い（点数が同じでも）、同じなら合意
 * - 返却版は類型の点数も控え、共通の類型評価の点数を直すと差分に出る
 * - 生徒の試験成績（生徒・学級の画面）も類型の点数で合計する
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
import {
  captureReturnSnapshot,
  getReturnDiff,
} from "@/electron-src/lib/prisma/returnSnapshot"
import { getStudentExamResults } from "@/electron-src/lib/prisma/student"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

let fixture: Awaited<ReturnType<typeof createFullTestExam>>
/** 類型 A=12点（配点 10 を超える）・B=6点 */
let levelA: { id: string }
let levelB: { id: string }

beforeEach(async () => {
  await cleanupTestDatabase()
  // 設問は4問・各10点。1問目だけを類型評価にする
  fixture = await createFullTestExam(testPrisma, {
    studentCount: 1,
    includeScores: false,
  })
  const scoreScale = await testPrisma.scoreScale.create({
    data: {
      examId: fixture.exam.id,
      name: "記述",
      levels: {
        create: [
          { label: "A", score: 12, sortOrder: 0 },
          { label: "B", score: 6, sortOrder: 1 },
        ],
      },
    },
    include: { levels: { orderBy: { sortOrder: "asc" } } },
  })
  ;[levelA, levelB] = scoreScale.levels
  await testPrisma.cropRegion.update({
    where: { id: fixture.cropRegions[0].id },
    data: { scoringMethod: "scale", scoreScaleId: scoreScale.id },
  })
})

afterAll(async () => {
  await cleanupTestDatabase()
  await testPrisma.$disconnect()
  await disconnectTestPrisma()
})

const examStudentId = () => fixture.examStudents[0].id

const writeScore = (
  cropRegionIndex: number,
  data: {
    status: string
    partialScore?: number
    scaleLevelId?: string
    userId?: string
  }
) =>
  testPrisma.questionScore.create({
    data: {
      cropRegionId: fixture.cropRegions[cropRegionIndex].id,
      examStudentId: examStudentId(),
      userId: data.userId ?? fixture.user.id,
      status: data.status,
      partialScore: data.partialScore,
      scaleLevelId: data.scaleLevelId,
    },
  })

const exportScores = async () => {
  const result = await fetchExportData(fixture.exam.id, [examStudentId()])
  return result.scoringData[0]
}

describe("Excel 出力", () => {
  it("類型評価の設問は類型の点数で、配点を超えて合計に入る", async () => {
    await writeScore(0, { status: "evaluated", scaleLevelId: levelA.id })
    await writeScore(1, { status: "correct" })
    await writeScore(2, { status: "partial", partialScore: 4 })

    const scoringData = await exportScores()
    expect(scoringData.scores.map((score) => score.score)).toEqual([
      12,
      10,
      4,
      null,
    ])
    expect(scoringData.totalScore).toBe(26)
    // 満点は配点の合計のまま
    expect(scoringData.totalMaxScore).toBe(40)
  })

  it("方式と合わない採点は未採点と同じに読む（点も記号も類型も出さない）", async () => {
    // 類型評価の設問の正答と、点の採点の設問の評価済み
    await writeScore(0, { status: "correct" })
    await writeScore(1, { status: "evaluated", scaleLevelId: levelB.id })
    await writeScore(2, { status: "incorrect" })

    const scoringData = await exportScores()
    expect(scoringData.scores.map((score) => score.score)).toEqual([
      null,
      null,
      0,
      null,
    ])
    expect(scoringData.scores.map((score) => score.status)).toEqual([
      "unscored",
      "unscored",
      "incorrect",
      "unscored",
    ])
    expect(scoringData.scores[1].scaleLevel).toBeNull()
    expect(scoringData.totalScore).toBe(0)
  })

  it("方式を戻せば、残しておいた採点が元の採点として出る", async () => {
    await writeScore(0, { status: "correct" })
    expect((await exportScores()).scores[0].status).toBe("unscored")

    await testPrisma.cropRegion.update({
      where: { id: fixture.cropRegions[0].id },
      data: { scoringMethod: "points" },
    })
    const scoringData = await exportScores()
    expect(scoringData.scores[0]).toMatchObject({
      status: "correct",
      score: 10,
    })
  })

  it("方式と合わない確定は無かったものとして読み、合う提案から解決する", async () => {
    await writeScore(0, { status: "evaluated", scaleLevelId: levelB.id })
    await testPrisma.scoreDecision.create({
      data: {
        cropRegionId: fixture.cropRegions[0].id,
        examStudentId: examStudentId(),
        verdict: "correct",
        decidedByUserId: fixture.user.id,
      },
    })
    expect((await exportScores()).scores[0]).toMatchObject({
      status: "evaluated",
      score: 6,
    })
  })

  it("小計も類型の点数で集める", async () => {
    // ビルダーは設問を小計へ交互に割り当てる（前半=問1,問3 / 後半=問2,問4）
    await writeScore(0, { status: "evaluated", scaleLevelId: levelB.id })
    await writeScore(2, { status: "correct" })

    const scoringData = await exportScores()
    const scores = scoringData.subtotalScores
      .map((subtotalScore) => subtotalScore.score)
      .sort()
    expect(scores).toEqual([16, null])
  })
})

describe("採点者の食い違い", () => {
  it("類型が違えば食い違い、同じなら合意", async () => {
    const otherUser = await testPrisma.user.create({
      data: { username: `other_${crypto.randomUUID()}`, name: "別の採点者" },
    })
    await writeScore(0, { status: "evaluated", scaleLevelId: levelA.id })
    const otherScore = await writeScore(0, {
      status: "evaluated",
      scaleLevelId: levelB.id,
      userId: otherUser.id,
    })
    expect((await exportScores()).scores[0].score).toBeNull()

    await testPrisma.questionScore.update({
      where: { id: otherScore.id },
      data: { scaleLevelId: levelA.id },
    })
    expect((await exportScores()).scores[0].score).toBe(12)
  })
})

describe("返却版の差分", () => {
  it("類型の点数を直すと、類型評価の設問が差分に出る", async () => {
    await writeScore(0, { status: "evaluated", scaleLevelId: levelA.id })
    await writeScore(1, { status: "correct" })
    await captureReturnSnapshot({
      examId: fixture.exam.id,
      examStudentIds: [examStudentId()],
    })

    const unchanged = await getReturnDiff(fixture.exam.id)
    expect(unchanged.diffs[0].changed).toBe(false)
    expect(unchanged.diffs[0].snapshotTotal).toBe(22)

    await testPrisma.scoreScaleLevel.update({
      where: { id: levelA.id },
      data: { score: 8 },
    })
    const [diff] = (await getReturnDiff(fixture.exam.id)).diffs
    expect(diff.changed).toBe(true)
    expect(diff.currentTotal).toBe(18)
    expect(diff.scoreChanges).toHaveLength(1)
    expect(diff.scoreChanges[0]).toMatchObject({
      cropRegionId: fixture.cropRegions[0].id,
      before: { status: "evaluated", scaleLabel: "A", value: 12 },
      after: { status: "evaluated", scaleLabel: "A", value: 8 },
    })
  })

  it("類型の記号を直しても差分に出る（答案に記号を印刷するため）", async () => {
    await writeScore(0, { status: "evaluated", scaleLevelId: levelA.id })
    await captureReturnSnapshot({
      examId: fixture.exam.id,
      examStudentIds: [examStudentId()],
    })
    await testPrisma.scoreScaleLevel.update({
      where: { id: levelA.id },
      data: { label: "S" },
    })
    const [diff] = (await getReturnDiff(fixture.exam.id)).diffs
    expect(diff.scoreChanges[0]).toMatchObject({
      before: { scaleLabel: "A", value: 12 },
      after: { scaleLabel: "S", value: 12 },
    })
  })
})

describe("生徒の試験成績", () => {
  it("類型の点数で合計し、方式と合わない採点は未採点として数える", async () => {
    await writeScore(0, { status: "evaluated", scaleLevelId: levelA.id })
    await writeScore(1, { status: "evaluated", scaleLevelId: levelB.id })
    await writeScore(2, { status: "correct" })

    const [result] = await getStudentExamResults(
      fixture.examStudents[0].studentId
    )
    expect(result.totalScore).toBe(22)
    // 問2（点の設問の評価済み）は採点済みに数えない
    expect(result.scoredCount).toBe(2)
    expect(result.status).toBe("partial")
  })
})
