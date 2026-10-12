/**
 * 類型評価の確定（docs/vlm-grading-design.md §4-8-5・§4-8-7 の S5）。
 *
 * 採点者の類型が違えば食い違いで、確定は類型を選ぶ。点は確定した類型の点数から読む。
 *
 * - 類型を確定すると類型を書き、確定点は書かない
 * - 別の類型評価の類型・方式と合わない判定・類型なしの評価済みは拒む
 * - 類型評価でない判定で確定し直すと類型を消す
 * - 裁定サマリの提案と確定に類型が載り、類型が違う2人は食い違いになる
 * - 出力は確定した類型の点数を読む
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
  upsertScoreDecision,
  type UpsertScoreDecisionData,
} from "@/electron-src/lib/prisma/scoreDecision"
import { getExamDecisionSummary } from "@/electron-src/lib/prisma/scoreDecisionSummary"

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
/** 別の類型評価（同じ試験）の類型 */
let foreignLevel: { id: string }

beforeEach(async () => {
  await cleanupTestDatabase()
  // 設問は4問・各10点。1問目だけを類型評価にする
  fixture = await createFullTestExam(testPrisma, {
    studentCount: 1,
    includeScores: false,
    includeStudentAnswerImages: true,
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
  const otherScale = await testPrisma.scoreScale.create({
    data: {
      examId: fixture.exam.id,
      name: "別の類型評価",
      levels: { create: [{ label: "S", score: 3, sortOrder: 0 }] },
    },
    include: { levels: true },
  })
  ;[foreignLevel] = otherScale.levels
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
const scaleRegionId = () => fixture.cropRegions[0].id

const decide = (overrides: Partial<UpsertScoreDecisionData>) =>
  upsertScoreDecision({
    cropRegionId: scaleRegionId(),
    examStudentId: examStudentId(),
    verdict: "evaluated",
    score: null,
    scaleLevelId: null,
    comment: null,
    decidedByUserId: fixture.user.id,
    ...overrides,
  })

const findDecision = () =>
  testPrisma.scoreDecision.findUnique({
    where: {
      cropRegionId_examStudentId: {
        cropRegionId: scaleRegionId(),
        examStudentId: examStudentId(),
      },
    },
  })

describe("類型の確定", () => {
  it("類型を確定すると類型を書き、確定点は書かない", async () => {
    const decision = await decide({ scaleLevelId: levelA.id, score: 5 })
    expect(decision.scaleLevelId).toBe(levelA.id)
    expect(decision.scaleLevel?.label).toBe("A")
    expect(decision.score).toBeNull()

    const stored = await findDecision()
    expect(stored).toMatchObject({
      verdict: "evaluated",
      scaleLevelId: levelA.id,
      score: null,
    })
  })

  it("確定し直すと類型が置き換わり、監査ログに類型の前後が残る", async () => {
    await decide({ scaleLevelId: levelA.id })
    await decide({ scaleLevelId: levelB.id })

    expect((await findDecision())?.scaleLevelId).toBe(levelB.id)
    const logs = await testPrisma.auditLog.findMany({
      where: { action: "exam.score.decide" },
      orderBy: { createdAt: "asc" },
    })
    const lastMetadata = JSON.parse(logs[logs.length - 1].metadata ?? "{}")
    expect(lastMetadata.changes).toContainEqual({
      field: "scaleLevel",
      label: "類型",
      before: "A",
      after: "B",
    })
  })

  it("別の類型評価の類型は拒む", async () => {
    await expect(decide({ scaleLevelId: foreignLevel.id })).rejects.toThrow(
      /この設問の類型表の類型ではありません/
    )
    expect(await findDecision()).toBeNull()
  })

  it("類型を選ばない評価済みは拒む", async () => {
    await expect(decide({ scaleLevelId: null })).rejects.toThrow(
      /確定する類型を選んでください/
    )
  })

  it("類型評価の設問を正解・部分点では確定できない", async () => {
    await expect(decide({ verdict: "correct" })).rejects.toThrow(
      /類型を選んで確定してください/
    )
    await expect(decide({ verdict: "partial", score: 4 })).rejects.toThrow(
      /類型を選んで確定してください/
    )
    expect(await findDecision()).toBeNull()
  })

  it("点の設問を類型評価では確定できない", async () => {
    await expect(
      decide({
        cropRegionId: fixture.cropRegions[1].id,
        scaleLevelId: levelA.id,
      })
    ).rejects.toThrow(/類型では確定できません/)
  })

  it("保留で確定し直すと類型を消す", async () => {
    await decide({ scaleLevelId: levelA.id })
    // 類型を送ってきても、評価済みでない判定では書かない
    await decide({ verdict: "pending", scaleLevelId: levelB.id })

    expect(await findDecision()).toMatchObject({
      verdict: "pending",
      scaleLevelId: null,
    })
  })
})

describe("裁定サマリと出力", () => {
  it("類型が違う2人は食い違いで、提案と確定に類型が載り、出力は確定した類型の点数", async () => {
    const otherUser = await testPrisma.user.create({
      data: { username: `other_${crypto.randomUUID()}`, name: "別の採点者" },
    })
    await testPrisma.userExam.create({
      data: { userId: otherUser.id, examId: fixture.exam.id, role: "EDITOR" },
    })
    await testPrisma.questionScore.createMany({
      data: [
        {
          cropRegionId: scaleRegionId(),
          examStudentId: examStudentId(),
          userId: fixture.user.id,
          status: "evaluated",
          scaleLevelId: levelA.id,
        },
        {
          cropRegionId: scaleRegionId(),
          examStudentId: examStudentId(),
          userId: otherUser.id,
          status: "evaluated",
          scaleLevelId: levelB.id,
        },
      ],
    })

    const findCell = async () => {
      const summary = await getExamDecisionSummary(
        fixture.exam.id,
        fixture.user.id
      )
      const question = summary.questions.find(
        (candidate) => candidate.cropRegionId === scaleRegionId()
      )
      return question?.cells[0]
    }

    const conflictCell = await findCell()
    expect(conflictCell?.reason).toBe("conflict")
    expect(
      conflictCell?.proposals
        .map((proposal) => ({
          scaleLevelId: proposal.scaleLevelId,
          scaleLevel: proposal.scaleLevel,
          scoreValue: proposal.scoreValue,
        }))
        .sort(
          (proposalA, proposalB) =>
            (proposalA.scoreValue ?? 0) - (proposalB.scoreValue ?? 0)
        )
    ).toEqual([
      {
        scaleLevelId: levelB.id,
        scaleLevel: { label: "B", score: 6 },
        scoreValue: 6,
      },
      {
        scaleLevelId: levelA.id,
        scaleLevel: { label: "A", score: 12 },
        scoreValue: 12,
      },
    ])
    expect(conflictCell?.scoreImpact).toBe(12)

    const exportBefore = await fetchExportData(fixture.exam.id, [
      examStudentId(),
    ])
    expect(exportBefore.scoringData[0].scores[0].score).toBeNull()

    await decide({ scaleLevelId: levelB.id })

    const decidedCell = await findCell()
    expect(decidedCell?.reason).toBe("decided")
    expect(decidedCell?.decision).toMatchObject({
      verdict: "evaluated",
      score: null,
      scaleLevelId: levelB.id,
      scaleLevel: { label: "B", score: 6 },
    })

    const exportAfter = await fetchExportData(fixture.exam.id, [
      examStudentId(),
    ])
    expect(exportAfter.scoringData[0].scores[0].score).toBe(6)
  })

  it("方式と合わない提案・確定は提案にも食い違いにも確定にも数えず、方式を戻すとまた数える", async () => {
    const otherUser = await testPrisma.user.create({
      data: { username: `other_${crypto.randomUUID()}`, name: "別の採点者" },
    })
    await testPrisma.userExam.create({
      data: { userId: otherUser.id, examId: fixture.exam.id, role: "EDITOR" },
    })
    // 類型評価の設問に、類型（合う）と正答（合わない）。確定も合わない正答で残す
    await testPrisma.questionScore.createMany({
      data: [
        {
          cropRegionId: scaleRegionId(),
          examStudentId: examStudentId(),
          userId: fixture.user.id,
          status: "evaluated",
          scaleLevelId: levelA.id,
        },
        {
          cropRegionId: scaleRegionId(),
          examStudentId: examStudentId(),
          userId: otherUser.id,
          status: "correct",
        },
      ],
    })
    await testPrisma.scoreDecision.create({
      data: {
        cropRegionId: scaleRegionId(),
        examStudentId: examStudentId(),
        verdict: "correct",
        decidedByUserId: fixture.user.id,
      },
    })

    const findQuestion = async () => {
      const summary = await getExamDecisionSummary(
        fixture.exam.id,
        fixture.user.id
      )
      const question = summary.questions.find(
        (candidate) => candidate.cropRegionId === scaleRegionId()
      )
      return { summary, question }
    }

    const onScale = await findQuestion()
    expect(onScale.summary.conflictCount).toBe(0)
    expect(onScale.summary.decidedCount).toBe(0)
    expect(onScale.summary.graderCount).toBe(1)
    expect(onScale.question?.cells).toEqual([])
    expect(onScale.question?.decidedCount).toBe(0)
    // 出力は合う類型の点数（合わない確定は無かったものとして読む）
    const exportOnScale = await fetchExportData(fixture.exam.id, [
      examStudentId(),
    ])
    expect(exportOnScale.scoringData[0].scores[0]).toMatchObject({
      status: "evaluated",
      score: 12,
    })

    // 方式を点に戻すと、残しておいた正答と確定がまた数えられる
    await testPrisma.cropRegion.update({
      where: { id: scaleRegionId() },
      data: { scoringMethod: "points" },
    })
    const onPoints = await findQuestion()
    expect(onPoints.summary.decidedCount).toBe(1)
    expect(onPoints.question?.cells).toHaveLength(1)
    expect(onPoints.question?.cells[0].reason).toBe("decided")
    expect(
      onPoints.question?.cells[0].proposals.map((proposal) => proposal.userId)
    ).toEqual([otherUser.id])
    const exportOnPoints = await fetchExportData(fixture.exam.id, [
      examStudentId(),
    ])
    expect(exportOnPoints.scoringData[0].scores[0].status).toBe("correct")
  })
})
