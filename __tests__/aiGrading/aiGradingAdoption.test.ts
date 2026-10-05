/**
 * AI の判定の採用と、古い試行の削除（docs/vlm-grading-design.md §1・§4-4・§10）。
 *
 * - 採用は実行した教員自身の採点（QuestionScore・覚え書き・朱書き）として書く
 * - 自分の採点が既にあるマスは、overwrite でなければ飛ばす（未採点の行は上書きしてよい）
 * - 採用できるのは実行した教員だけ
 * - 古い試行の削除は、採用済み・結果待ち・他の教員の試行を残す
 */

import * as fs from "fs"
import * as path from "path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_DB_PATH = path.resolve(__dirname, "../../data/test-database.db")

vi.mock("../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

import { createGradingJobRunner } from "@/electron-src/lib/aiGrading/gradingJobRunner"
import {
  adoptAiGradingAttempts,
  adoptBlankAnswers,
} from "@/electron-src/lib/prisma/aiGradingAdoption"
import {
  deleteAiGradingAttempts,
  listAiGradingRunsByCropRegion,
} from "@/electron-src/lib/prisma/aiGradingRun"
import { setQuestionScore } from "@/electron-src/lib/prisma/questionScoreWrite"

import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../helpers/testPrismaClient"
import {
  completedResponse,
  createAiGradingFixture,
  createFakeProvider,
  createTestDependencies,
  PARTIAL_JUDGEMENT,
} from "./helpers/aiGradingFixture"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

let fixture: Awaited<ReturnType<typeof createAiGradingFixture>>
const dataDirectories: string[] = []

beforeEach(async () => {
  await cleanupTestDatabase()
  fixture = await createAiGradingFixture(testPrisma)
  dataDirectories.push(fixture.dataDirectory)
})

afterAll(async () => {
  dataDirectories.forEach((dataDirectory) =>
    fs.rmSync(dataDirectory, { recursive: true, force: true })
  )
  await disconnectTestPrisma()
  await testPrisma.$disconnect()
})

const examStudentIds = () =>
  fixture.exam.examStudents.map((examStudent) => examStudent.id)

/** 全答案を採点し、試行を答案の順で返す */
async function gradeAll(actorUserId: string = fixture.exam.user.id) {
  const { provider } = createFakeProvider({
    respond: async () => completedResponse(PARTIAL_JUDGEMENT),
  })
  const runner = createGradingJobRunner(
    createTestDependencies(provider, fixture.dataDirectory)
  )
  const { run, finished } = await runner.startGradingRun(
    {
      promptId: fixture.prompt.id,
      examStudentIds: examStudentIds(),
      provider: "anthropic",
      model: "claude-test",
      effort: "medium",
      mode: "realtime",
      imageScale: 1,
    },
    actorUserId
  )
  await finished
  const attempts = await testPrisma.aiGradingAttempt.findMany({
    where: { runId: run.id },
  })
  return examStudentIds().map((examStudentId) => {
    const attempt = attempts.find(
      (candidate) => candidate.examStudentId === examStudentId
    )
    if (!attempt) throw new Error("試行がありません")
    return attempt
  })
}

const ownScore = (examStudentId: string, userId = fixture.exam.user.id) =>
  testPrisma.questionScore.findFirst({
    where: { examStudentId, cropRegionId: fixture.cropRegion.id, userId },
    include: { drawingAnnotations: true },
  })

const PLACEMENT = { x: 0.12, y: 0.22, text: "解を\n書きましょう", fontSize: 3 }

describe("adoptAiGradingAttempts", () => {
  it("判定・覚え書き・朱書きを、実行した教員の採点として書く", async () => {
    const [attempt] = await gradeAll()

    const results = await adoptAiGradingAttempts(
      {
        adoptions: [{ attemptId: attempt.id, annotation: PLACEMENT }],
        overwrite: false,
      },
      fixture.exam.user.id
    )

    expect(results).toEqual([{ targetId: attempt.id, outcome: "adopted" }])
    const questionScore = await ownScore(attempt.examStudentId)
    expect(questionScore).toMatchObject({
      status: "partial",
      comment: PARTIAL_JUDGEMENT.comment,
    })
    expect(questionScore?.partialScore?.toNumber()).toBe(3)
    expect(questionScore?.drawingAnnotations).toHaveLength(1)
    expect(questionScore?.drawingAnnotations[0]).toMatchObject({
      type: "text",
      text: PLACEMENT.text,
      x: PLACEMENT.x,
      y: PLACEMENT.y,
      fontSize: 3,
      color: "#ef4444",
      anchorDirection: "top-left",
    })

    const adoptedAttempt = await testPrisma.aiGradingAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    })
    expect(adoptedAttempt.adoptedQuestionScoreId).toBe(questionScore?.id)
    expect(adoptedAttempt.adoptedDrawingAnnotationId).toBe(
      questionScore?.drawingAnnotations[0].id
    )
    expect(adoptedAttempt.adoptedAt).not.toBeNull()

    const auditLog = await testPrisma.auditLog.findFirst({
      where: { action: "exam.ai_grading.adopt" },
    })
    expect(auditLog?.entityId).toBe(fixture.cropRegion.id)
  })

  it("自分の採点が既にあるマスは飛ばし、overwrite なら上書きする", async () => {
    const [scoredAttempt, unscoredAttempt] = await gradeAll()
    await setQuestionScore({
      examStudentId: scoredAttempt.examStudentId,
      cropRegionId: fixture.cropRegion.id,
      userId: fixture.exam.user.id,
      status: "correct",
      partialScore: null,
    })
    // 未採点の行（注釈の置き場所として用意されたもの）は採点済みではない
    await setQuestionScore({
      examStudentId: unscoredAttempt.examStudentId,
      cropRegionId: fixture.cropRegion.id,
      userId: fixture.exam.user.id,
      status: "unscored",
      partialScore: null,
    })

    const skipped = await adoptAiGradingAttempts(
      {
        adoptions: [
          { attemptId: scoredAttempt.id, annotation: null },
          { attemptId: unscoredAttempt.id, annotation: null },
        ],
        overwrite: false,
      },
      fixture.exam.user.id
    )
    expect(skipped.map((result) => result.outcome)).toEqual([
      "skipped_already_scored",
      "adopted",
    ])
    expect((await ownScore(scoredAttempt.examStudentId))?.status).toBe(
      "correct"
    )

    const overwritten = await adoptAiGradingAttempts(
      {
        adoptions: [{ attemptId: scoredAttempt.id, annotation: null }],
        overwrite: true,
      },
      fixture.exam.user.id
    )
    expect(overwritten[0].outcome).toBe("adopted")
    expect((await ownScore(scoredAttempt.examStudentId))?.status).toBe(
      "partial"
    )
  })

  it("上書きで採用し直すと、前に採用した朱書きを置き換える", async () => {
    const [attempt] = await gradeAll()
    const adoptWithAnnotation = (overwrite: boolean) =>
      adoptAiGradingAttempts(
        {
          adoptions: [{ attemptId: attempt.id, annotation: PLACEMENT }],
          overwrite,
        },
        fixture.exam.user.id
      )
    await adoptWithAnnotation(false)
    await adoptWithAnnotation(true)

    const questionScore = await ownScore(attempt.examStudentId)
    expect(questionScore?.drawingAnnotations).toHaveLength(1)
  })

  it("点だけの採用では朱書きを書かない", async () => {
    const [attempt] = await gradeAll()
    const results = await adoptAiGradingAttempts(
      {
        adoptions: [{ attemptId: attempt.id, annotation: PLACEMENT }],
        overwrite: false,
        parts: { score: true, annotation: false },
      },
      fixture.exam.user.id
    )
    expect(results[0].outcome).toBe("adopted")
    const questionScore = await ownScore(attempt.examStudentId)
    expect(questionScore?.status).toBe("partial")
    expect(questionScore?.drawingAnnotations).toHaveLength(0)
    const adoptedAttempt = await testPrisma.aiGradingAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    })
    expect(adoptedAttempt.adoptedAt).not.toBeNull()
    expect(adoptedAttempt.adoptedDrawingAnnotationId).toBeNull()
  })

  it("朱書きだけの採用では点を書かず、採点済みのマスにも書ける", async () => {
    const [attempt] = await gradeAll()
    await setQuestionScore({
      examStudentId: attempt.examStudentId,
      cropRegionId: fixture.cropRegion.id,
      userId: fixture.exam.user.id,
      status: "correct",
      partialScore: null,
    })
    const results = await adoptAiGradingAttempts(
      {
        adoptions: [{ attemptId: attempt.id, annotation: PLACEMENT }],
        overwrite: false,
        parts: { score: false, annotation: true },
      },
      fixture.exam.user.id
    )
    expect(results[0].outcome).toBe("adopted")
    const questionScore = await ownScore(attempt.examStudentId)
    // 教員が付けた点はそのまま
    expect(questionScore?.status).toBe("correct")
    expect(questionScore?.drawingAnnotations).toHaveLength(1)
    const adoptedAttempt = await testPrisma.aiGradingAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    })
    expect(adoptedAttempt.adoptedAt).toBeNull()
    expect(adoptedAttempt.adoptedDrawingAnnotationId).toBe(
      questionScore?.drawingAnnotations[0].id
    )
  })

  it("朱書きだけの採用は、反映済み・朱書きが無いものを飛ばす", async () => {
    const [attempt, otherAttempt] = await gradeAll()
    const annotationOnly = { score: false, annotation: true }
    await adoptAiGradingAttempts(
      {
        adoptions: [{ attemptId: attempt.id, annotation: PLACEMENT }],
        overwrite: false,
        parts: annotationOnly,
      },
      fixture.exam.user.id
    )
    const results = await adoptAiGradingAttempts(
      {
        adoptions: [
          { attemptId: attempt.id, annotation: PLACEMENT },
          { attemptId: otherAttempt.id, annotation: null },
        ],
        overwrite: false,
        parts: annotationOnly,
      },
      fixture.exam.user.id
    )
    expect(results.map((result) => result.outcome)).toEqual([
      "skipped_annotation_already_adopted",
      "skipped_no_annotation",
    ])
    expect(
      (await ownScore(attempt.examStudentId))?.drawingAnnotations
    ).toHaveLength(1)
  })

  it("朱書きを反映済みなら、あとで点を採用しても朱書きは書き直さない", async () => {
    const [attempt] = await gradeAll()
    await adoptAiGradingAttempts(
      {
        adoptions: [{ attemptId: attempt.id, annotation: PLACEMENT }],
        overwrite: false,
        parts: { score: false, annotation: true },
      },
      fixture.exam.user.id
    )
    const firstAnnotationId = (await ownScore(attempt.examStudentId))
      ?.drawingAnnotations[0].id
    await adoptAiGradingAttempts(
      {
        adoptions: [
          { attemptId: attempt.id, annotation: { ...PLACEMENT, x: 0.5 } },
        ],
        overwrite: false,
      },
      fixture.exam.user.id
    )
    const questionScore = await ownScore(attempt.examStudentId)
    expect(questionScore?.status).toBe("partial")
    expect(questionScore?.drawingAnnotations.map((row) => row.id)).toEqual([
      firstAnnotationId,
    ])
  })

  it("実行した教員でなければ採用できない", async () => {
    const [attempt] = await gradeAll()

    const results = await adoptAiGradingAttempts(
      {
        adoptions: [{ attemptId: attempt.id, annotation: null }],
        overwrite: true,
      },
      fixture.otherUser.id
    )

    expect(results[0].outcome).toBe("skipped_not_executor")
    expect(
      await ownScore(attempt.examStudentId, fixture.otherUser.id)
    ).toBeNull()
  })

  it("判定の出ていない試行・無い試行は飛ばす", async () => {
    const [attempt] = await gradeAll()
    await testPrisma.aiGradingAttempt.update({
      where: { id: attempt.id },
      data: { state: "errored" },
    })

    const results = await adoptAiGradingAttempts(
      {
        adoptions: [
          { attemptId: attempt.id, annotation: null },
          { attemptId: "missing-attempt", annotation: null },
        ],
        overwrite: false,
      },
      fixture.exam.user.id
    )

    expect(results.map((result) => result.outcome)).toEqual([
      "skipped_not_succeeded",
      "skipped_not_found",
    ])
  })
})

describe("adoptBlankAnswers", () => {
  it("白紙の答案を無答として書き、採点済みのマスは飛ばす", async () => {
    const [firstExamStudentId, secondExamStudentId] = examStudentIds()
    await setQuestionScore({
      examStudentId: secondExamStudentId,
      cropRegionId: fixture.cropRegion.id,
      userId: fixture.exam.user.id,
      status: "correct",
      partialScore: null,
    })

    const results = await adoptBlankAnswers(
      {
        cropRegionId: fixture.cropRegion.id,
        examStudentIds: [firstExamStudentId, secondExamStudentId],
        overwrite: false,
      },
      fixture.exam.user.id
    )

    expect(results).toEqual([
      { targetId: firstExamStudentId, outcome: "adopted" },
      { targetId: secondExamStudentId, outcome: "skipped_already_scored" },
    ])
    expect((await ownScore(firstExamStudentId))?.status).toBe("no_answer")
    expect((await ownScore(secondExamStudentId))?.status).toBe("correct")
  })
})

describe("deleteAiGradingAttempts", () => {
  it("採用済み・結果待ち・他の教員の試行は消さない", async () => {
    const [adoptedAttempt, oldAttempt, pendingAttempt] = await gradeAll()
    await adoptAiGradingAttempts(
      {
        adoptions: [{ attemptId: adoptedAttempt.id, annotation: null }],
        overwrite: false,
      },
      fixture.exam.user.id
    )
    await testPrisma.aiGradingAttempt.update({
      where: { id: pendingAttempt.id },
      data: { state: "pending" },
    })
    const [otherUsersAttempt] = await gradeAll(fixture.otherUser.id)

    const deletedCount = await deleteAiGradingAttempts(
      [
        adoptedAttempt.id,
        oldAttempt.id,
        pendingAttempt.id,
        otherUsersAttempt.id,
      ],
      fixture.exam.user.id
    )

    expect(deletedCount).toBe(1)
    const remainingIds = (await testPrisma.aiGradingAttempt.findMany()).map(
      (attempt) => attempt.id
    )
    expect(remainingIds).not.toContain(oldAttempt.id)
    expect(remainingIds).toEqual(
      expect.arrayContaining([
        adoptedAttempt.id,
        pendingAttempt.id,
        otherUsersAttempt.id,
      ])
    )
  })
})

describe("listAiGradingRunsByCropRegion", () => {
  it("既定は自分の実行だけ、null なら全員の実行を返す（文字列の列は union に絞る）", async () => {
    await gradeAll()
    await gradeAll(fixture.otherUser.id)

    const ownRuns = await listAiGradingRunsByCropRegion(
      fixture.cropRegion.id,
      fixture.exam.user.id
    )
    const allRuns = await listAiGradingRunsByCropRegion(
      fixture.cropRegion.id,
      null
    )

    expect(ownRuns).toHaveLength(1)
    expect(ownRuns[0].attempts).toHaveLength(3)
    expect(ownRuns[0].status).toBe("ended")
    expect(ownRuns[0].attempts[0].state).toBe("succeeded")
    expect("passcode" in ownRuns[0].user).toBe(false)
    expect(allRuns).toHaveLength(2)
  })
})
