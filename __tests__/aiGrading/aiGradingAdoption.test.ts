/**
 * AI の判定の採用と、古い試行の削除（docs/vlm-grading-design.md §1・§4-4・§10）。
 *
 * - 採用は実行した教員自身の採点（QuestionScore・覚え書き）として書く。AI の朱書きの文案は書かない
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
import { adoptAiGradingAttempts } from "@/electron-src/lib/prisma/aiGradingAdoption"
import {
  deleteAiGradingAttempts,
  listAiGradingRunsByCropRegion,
  listAiGradingRunsByExam,
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
async function gradeAll(
  actorUserId: string = fixture.exam.user.id,
  judgement: object = PARTIAL_JUDGEMENT
) {
  const { provider } = createFakeProvider({
    respond: async () => completedResponse(judgement),
  })
  const runner = createGradingJobRunner(
    createTestDependencies(provider, fixture.dataDirectory)
  )
  const { run, finished } = await runner.startGradingRun(
    {
      purpose: "grade" as const,
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

describe("adoptAiGradingAttempts", () => {
  it("判定・覚え書きを、実行した教員の採点として書く（AI の朱書きの文案は書かない）", async () => {
    const [attempt] = await gradeAll()

    const results = await adoptAiGradingAttempts(
      {
        adoptions: [{ attemptId: attempt.id }],
        overwrite: false,
      },
      fixture.exam.user.id
    )

    expect(results).toEqual([{ targetId: attempt.id, outcome: "adopted" }])
    const questionScore = await ownScore(attempt.examStudentId)
    expect(questionScore).toMatchObject({
      status: "partial",
      comment: PARTIAL_JUDGEMENT.observation,
    })
    expect(questionScore?.partialScore?.toNumber()).toBe(3)
    expect(questionScore?.drawingAnnotations).toHaveLength(0)

    const adoptedAttempt = await testPrisma.aiGradingAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    })
    expect(adoptedAttempt.adoptedQuestionScoreId).toBe(questionScore?.id)
    expect(adoptedAttempt.adoptedDrawingAnnotationId).toBeNull()
    expect(adoptedAttempt.adoptedAt).not.toBeNull()

    const auditLog = await testPrisma.auditLog.findFirst({
      where: { action: "exam.ai_grading.adopt" },
    })
    expect(auditLog?.entityId).toBe(fixture.cropRegion.id)
  })

  it("点の無い保留は、点を null のまま保留として書く", async () => {
    const [attempt] = await gradeAll(fixture.exam.user.id, {
      ...PARTIAL_JUDGEMENT,
      status: "pending",
      partialScore: null,
    })
    expect(attempt).toMatchObject({
      state: "succeeded",
      status: "pending",
      partialScore: null,
    })

    const results = await adoptAiGradingAttempts(
      {
        adoptions: [{ attemptId: attempt.id }],
        overwrite: false,
      },
      fixture.exam.user.id
    )

    expect(results).toEqual([{ targetId: attempt.id, outcome: "adopted" }])
    expect(await ownScore(attempt.examStudentId)).toMatchObject({
      status: "pending",
      partialScore: null,
    })
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
          { attemptId: scoredAttempt.id },
          { attemptId: unscoredAttempt.id },
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
        adoptions: [{ attemptId: scoredAttempt.id }],
        overwrite: true,
      },
      fixture.exam.user.id
    )
    expect(overwritten[0].outcome).toBe("adopted")
    expect((await ownScore(scoredAttempt.examStudentId))?.status).toBe(
      "partial"
    )
  })

  it("実行した教員でなければ採用できない", async () => {
    const [attempt] = await gradeAll()

    const results = await adoptAiGradingAttempts(
      {
        adoptions: [{ attemptId: attempt.id }],
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
          { attemptId: attempt.id },
          { attemptId: "missing-attempt" },
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

describe("deleteAiGradingAttempts", () => {
  it("採用済み・結果待ち・他の教員の試行は消さない", async () => {
    const [adoptedAttempt, oldAttempt, pendingAttempt] = await gradeAll()
    await adoptAiGradingAttempts(
      {
        adoptions: [{ attemptId: adoptedAttempt.id }],
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

    // 1段目のあとに自動で続いた2段目（項目の案）の実行も並ぶので、1段目だけを見る
    const ownRuns = (
      await listAiGradingRunsByCropRegion(
        fixture.cropRegion.id,
        fixture.exam.user.id
      )
    ).filter((run) => run.purpose === "grade")
    const allRuns = (
      await listAiGradingRunsByCropRegion(fixture.cropRegion.id, null)
    ).filter((run) => run.purpose === "grade")

    expect(ownRuns).toHaveLength(1)
    expect(ownRuns[0].attempts).toHaveLength(3)
    expect(ownRuns[0].status).toBe("ended")
    expect(ownRuns[0].attempts[0].state).toBe("succeeded")
    expect("passcode" in ownRuns[0].user).toBe(false)
    expect(allRuns).toHaveLength(2)
  })
})

describe("listAiGradingRunsByExam", () => {
  it("試験の設問をたどって、その教員の実行だけを試行とプロンプト付きで返す", async () => {
    await gradeAll()
    await gradeAll(fixture.otherUser.id)

    const ownRuns = (
      await listAiGradingRunsByExam(fixture.exam.exam.id, fixture.exam.user.id)
    ).filter((run) => run.purpose === "grade")
    const otherExamRuns = await listAiGradingRunsByExam(
      "exam-not-exists",
      fixture.exam.user.id
    )

    expect(ownRuns).toHaveLength(1)
    expect(ownRuns[0].purpose).toBe("grade")
    expect(ownRuns[0].prompt.cropRegionId).toBe(fixture.cropRegion.id)
    expect(ownRuns[0].attempts.map((attempt) => attempt.state)).toEqual([
      "succeeded",
      "succeeded",
      "succeeded",
    ])
    expect(otherExamRuns).toHaveLength(0)
  })
})
