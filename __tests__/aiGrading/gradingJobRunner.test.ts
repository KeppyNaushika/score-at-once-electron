/**
 * 採点の実行（その場の採点・バッチ）と改訂を、偽の事業者でテスト DB に対して走らせる。
 *
 * 外部へは何も送らない。答案画像は合成した PNG。
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

import { createBatchCollector } from "@/electron-src/lib/aiGrading/batchPoller"
import { createGradingJobRunner } from "@/electron-src/lib/aiGrading/gradingJobRunner"
import { runPromptRevision } from "@/electron-src/lib/aiGrading/promptRevisionRunner"
import { GradingProviderError } from "@/electron-src/lib/aiGrading/providers/providerShared"
import type { ProviderGradingResponse } from "@/electron-src/lib/aiGrading/providers/types"
import { setQuestionScore } from "@/electron-src/lib/prisma/questionScoreWrite"
import { AI_GRADING_TEMPLATE_VERSION } from "@/lib/shared/aiGrading/promptBuilder"

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
/** 合成した答案画像を置いた一時ディレクトリ（最後にまとめて消す） */
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

const startInput = (mode: "realtime" | "batch" = "realtime") => ({
  promptId: fixture.prompt.id,
  examStudentIds: examStudentIds(),
  provider: "anthropic" as const,
  model: "claude-test",
  effort: "medium" as const,
  mode,
  imageScale: 1,
})

const attemptsOf = (runId: string) =>
  testPrisma.aiGradingAttempt.findMany({
    where: { runId },
    orderBy: { examStudentId: "asc" },
  })

describe("その場の採点", () => {
  it("答案ごとに試行を作り、検証を通った判定を書く", async () => {
    const { provider, gradeRequests } = createFakeProvider({
      respond: async () => completedResponse(PARTIAL_JUDGEMENT),
    })
    const dependencies = createTestDependencies(provider, fixture.dataDirectory)
    const runner = createGradingJobRunner(dependencies)

    const { run, finished } = await runner.startGradingRun(
      startInput(),
      fixture.exam.user.id
    )
    await finished

    const storedRun = await testPrisma.aiGradingRun.findUniqueOrThrow({
      where: { id: run.id },
    })
    expect(storedRun).toMatchObject({
      status: "ended",
      purpose: "grade",
      templateVersion: AI_GRADING_TEMPLATE_VERSION,
      submittedClientId: "client-this-machine",
      userId: fixture.exam.user.id,
    })
    expect(storedRun.points?.toNumber()).toBe(5)
    expect(storedRun.endedAt).not.toBeNull()

    const attempts = await attemptsOf(run.id)
    expect(attempts).toHaveLength(3)
    attempts.forEach((attempt) => {
      expect(attempt).toMatchObject({
        state: "succeeded",
        status: "partial",
        comment: PARTIAL_JUDGEMENT.comment,
        annotationText: PARTIAL_JUDGEMENT.annotation,
        transcription: PARTIAL_JUDGEMENT.transcription,
        confidence: "high",
        inputTokens: 100,
        outputTokens: 20,
      })
      expect(attempt.partialScore?.toNumber()).toBe(3)
    })

    // custom_id は試行の id。固定部は全件でバイト単位で同じ
    expect(gradeRequests.map((request) => request.customId).sort()).toEqual(
      attempts.map((attempt) => attempt.id).sort()
    )
    const fixedTexts = new Set(
      gradeRequests.map((request) =>
        JSON.stringify([request.systemText, request.fixedParts])
      )
    )
    expect(fixedTexts.size).toBe(1)
    expect(gradeRequests[0].variableParts).toHaveLength(1)
    expect(gradeRequests[0].variableParts[0].kind).toBe("image")
    expect(JSON.stringify(gradeRequests[0].fixedParts)).toContain(
      "## 配点\\n5点"
    )

    const notifyProgress = vi.mocked(dependencies.notifyProgress)
    expect(notifyProgress.mock.calls.at(-1)?.[0]).toMatchObject({
      runId: run.id,
      status: "ended",
      total: 3,
      completed: 3,
      succeeded: 3,
      failed: 0,
    })
  })

  it("最初の1件を送り終えてから残りを並行させる（前置きのキャッシュを先に作る）", async () => {
    const events: string[] = []
    const { provider } = createFakeProvider({
      respond: async (request) => {
        events.push(`start:${request.customId}`)
        await new Promise((resolve) => setTimeout(resolve, 10))
        events.push(`end:${request.customId}`)
        return completedResponse(PARTIAL_JUDGEMENT)
      },
    })
    const runner = createGradingJobRunner(
      createTestDependencies(provider, fixture.dataDirectory)
    )
    const { finished } = await runner.startGradingRun(
      startInput(),
      fixture.exam.user.id
    )
    await finished

    // 1件目が終わるまで2件目は始まらない。残り2件は並行（同時実行数 2）
    expect(events[0]).toMatch(/^start:/)
    expect(events[1]).toBe(events[0].replace("start:", "end:"))
    expect(events[2]).toMatch(/^start:/)
    expect(events[3]).toMatch(/^start:/)
  })

  it("検証で外れた判定は errored、拒否は refused、打ち切りは errored で書く", async () => {
    const responses: ProviderGradingResponse[] = [
      completedResponse({ ...PARTIAL_JUDGEMENT, partialScore: 7 }),
      {
        ...completedResponse({}),
        parsedJson: null,
        stop: "refused",
        errorMessage: "モデルが応答を拒否しました",
      },
      {
        ...completedResponse({}),
        parsedJson: null,
        stop: "max_tokens",
        errorMessage: "出力が上限で打ち切られました",
      },
    ]
    const { provider } = createFakeProvider({
      respond: async () => responses.shift() ?? completedResponse({}),
    })
    const runner = createGradingJobRunner(
      createTestDependencies(provider, fixture.dataDirectory, {
        getConcurrency: () => 1,
      })
    )
    const { run, finished } = await runner.startGradingRun(
      startInput(),
      fixture.exam.user.id
    )
    await finished

    const attempts = await testPrisma.aiGradingAttempt.findMany({
      where: { runId: run.id },
    })
    const states = attempts.map((attempt) => attempt.state).sort()
    expect(states).toEqual(["errored", "errored", "refused"])
    const outOfRange = attempts.find((attempt) =>
      attempt.errorMessage.includes("範囲")
    )
    expect(outOfRange?.status).toBe("unscored")
    expect(outOfRange?.partialScore).toBeNull()
  })

  it("中止すると送信中の呼び出しを打ち切り、結果待ちの試行を閉じる", async () => {
    let notifyStarted: () => void = () => {}
    const started = new Promise<void>((resolve) => {
      notifyStarted = resolve
    })
    const { provider } = createFakeProvider({
      respond: (_request, signal) => {
        notifyStarted()
        return new Promise((_resolve, reject) => {
          // 実際の SDK と同じく、中止済みの signal ならすぐ失敗する
          if (signal.aborted) {
            reject(new GradingProviderError("aborted", "中止されました"))
          }
          signal.addEventListener("abort", () =>
            reject(new GradingProviderError("aborted", "中止されました"))
          )
        })
      },
    })
    const runner = createGradingJobRunner(
      createTestDependencies(provider, fixture.dataDirectory)
    )
    const { run, finished } = await runner.startGradingRun(
      startInput(),
      fixture.exam.user.id
    )
    await started

    await expect(
      runner.cancelRun(run.id, fixture.otherUser.id)
    ).rejects.toThrow("実行した教員だけ")
    await runner.cancelRun(run.id, fixture.exam.user.id)
    await finished

    const storedRun = await testPrisma.aiGradingRun.findUniqueOrThrow({
      where: { id: run.id },
    })
    expect(storedRun.status).toBe("canceled")
    const attempts = await attemptsOf(run.id)
    attempts.forEach((attempt) => {
      expect(attempt.state).toBe("errored")
      expect(attempt.errorMessage).toBe("中止しました")
    })
  })

  it("認証の失敗は run 全体を止める", async () => {
    const { provider, gradeRequests } = createFakeProvider({
      respond: async () => {
        throw new GradingProviderError("authentication", "invalid x-api-key")
      },
    })
    const runner = createGradingJobRunner(
      createTestDependencies(provider, fixture.dataDirectory, {
        getConcurrency: () => 1,
      })
    )
    const { run, finished } = await runner.startGradingRun(
      startInput(),
      fixture.exam.user.id
    )
    await finished

    expect(gradeRequests).toHaveLength(1)
    const storedRun = await testPrisma.aiGradingRun.findUniqueOrThrow({
      where: { id: run.id },
    })
    expect(storedRun.status).toBe("failed")
    const attempts = await attemptsOf(run.id)
    attempts.forEach((attempt) => {
      expect(attempt.state).toBe("errored")
      expect(attempt.errorMessage).toContain("invalid x-api-key")
    })
  })

  it("事業者を用意できなければ（同意・キーが無い）何も作らない", async () => {
    const { provider } = createFakeProvider({})
    const runner = createGradingJobRunner(
      createTestDependencies(provider, fixture.dataDirectory, {
        resolveProvider: () => {
          throw new Error("API キーが設定されていません")
        },
      })
    )

    await expect(
      runner.startGradingRun(startInput(), fixture.exam.user.id)
    ).rejects.toThrow("API キーが設定されていません")
    expect(await testPrisma.aiGradingRun.count()).toBe(0)
  })

  it("答案画像の無い答案が含まれていれば始めない", async () => {
    const { provider } = createFakeProvider({})
    const runner = createGradingJobRunner(
      createTestDependencies(provider, fixture.dataDirectory)
    )
    await testPrisma.studentAnswerImage.deleteMany({
      where: { examStudentId: examStudentIds()[0] },
    })

    await expect(
      runner.startGradingRun(startInput(), fixture.exam.user.id)
    ).rejects.toThrow("答案画像の無い答案が1件")
    expect(await testPrisma.aiGradingRun.count()).toBe(0)
  })
})

describe("バッチ", () => {
  it("預けて、この端末の回収で結果を取り込み、返らなかった試行は期限切れにする", async () => {
    let batchStatus: "in_progress" | "ended" = "in_progress"
    const fake = createFakeProvider({
      batchStatus: () => batchStatus,
      batchResults: () => [],
    })
    const dependencies = createTestDependencies(
      fake.provider,
      fixture.dataDirectory
    )
    const runner = createGradingJobRunner(dependencies)
    const { run } = await runner.startGradingRun(
      startInput("batch"),
      fixture.exam.user.id
    )

    expect(fake.submittedBatches).toHaveLength(1)
    expect(fake.submittedBatches[0]).toHaveLength(3)
    const submittedRun = await testPrisma.aiGradingRun.findUniqueOrThrow({
      where: { id: run.id },
    })
    expect(submittedRun).toMatchObject({
      status: "in_progress",
      mode: "batch",
      externalBatchId: "batch_fake_1",
      submittedClientId: "client-this-machine",
    })

    // 別の端末は回収しない
    const otherMachine = createBatchCollector(
      createTestDependencies(fake.provider, fixture.dataDirectory, {
        getClientId: () => "client-other-machine",
      })
    )
    batchStatus = "ended"
    await otherMachine.pollOnce()
    expect(
      (await attemptsOf(run.id)).every((attempt) => attempt.state === "pending")
    ).toBe(true)

    // まだ処理中なら何もしない
    batchStatus = "in_progress"
    const collector = createBatchCollector(dependencies)
    await collector.pollOnce()
    expect(
      (
        await testPrisma.aiGradingRun.findUniqueOrThrow({
          where: { id: run.id },
        })
      ).status
    ).toBe("in_progress")

    // 終わったら custom_id で対応付けて取り込む（届いたのは2件だけ）
    const [firstAttempt, secondAttempt, thirdAttempt] = await attemptsOf(run.id)
    const batchResults = [
      {
        customId: firstAttempt.id,
        response: completedResponse(PARTIAL_JUDGEMENT),
      },
      {
        customId: secondAttempt.id,
        response: completedResponse({
          ...PARTIAL_JUDGEMENT,
          status: "correct",
          partialScore: null,
          annotation: null,
        }),
      },
      // この run のものでない custom_id は無視する
      {
        customId: "not-an-attempt",
        response: completedResponse(PARTIAL_JUDGEMENT),
      },
    ]
    const endedFake = createFakeProvider({
      batchStatus: () => "ended",
      batchResults: () => batchResults,
    })
    const endedCollector = createBatchCollector(
      createTestDependencies(endedFake.provider, fixture.dataDirectory)
    )
    await endedCollector.pollOnce()

    const attempts = await attemptsOf(run.id)
    const attemptById = new Map(
      attempts.map((attempt) => [attempt.id, attempt])
    )
    expect(attemptById.get(firstAttempt.id)?.state).toBe("succeeded")
    expect(attemptById.get(secondAttempt.id)).toMatchObject({
      state: "succeeded",
      status: "correct",
      annotationText: "",
    })
    expect(attemptById.get(thirdAttempt.id)?.state).toBe("expired")
    const collectedRun = await testPrisma.aiGradingRun.findUniqueOrThrow({
      where: { id: run.id },
    })
    expect(collectedRun.status).toBe("ended")
    expect(endedFake.cleanupBatch).toHaveBeenCalledWith("batch_fake_1")

    // 取り込み済みの run は2度取り込まない
    await endedCollector.pollOnce()
    expect(endedFake.cleanupBatch).toHaveBeenCalledTimes(1)
  })
})

describe("プロンプトの改訂", () => {
  it("食い違いを添えて頼み、元を親とする新しいプロンプトを作る", async () => {
    // 1件目の答案を AI が採点し、教員は別の点を付けている
    const gradingFake = createFakeProvider({
      respond: async () => completedResponse(PARTIAL_JUDGEMENT),
    })
    const runner = createGradingJobRunner(
      createTestDependencies(gradingFake.provider, fixture.dataDirectory)
    )
    const { run, finished } = await runner.startGradingRun(
      { ...startInput(), examStudentIds: [examStudentIds()[0]] },
      fixture.exam.user.id
    )
    await finished
    const [attempt] = await attemptsOf(run.id)
    await setQuestionScore({
      examStudentId: examStudentIds()[0],
      cropRegionId: fixture.cropRegion.id,
      userId: fixture.exam.user.id,
      status: "partial",
      partialScore: 4,
    })
    await testPrisma.questionScore.updateMany({
      where: { examStudentId: examStudentIds()[0] },
      data: { comment: "途中式があれば4点" },
    })

    const revisionFake = createFakeProvider({
      respond: async () =>
        completedResponse({
          questionText: "x^2 - 5x + 6 = 0 を解け。",
          modelAnswerText: "x = 2, 3",
          rubricText: "因数分解で2点、途中式があれば4点、解がそろって満点。",
          annotationInstruction: "部分点の答案にだけ入れる",
          message: "途中式の配点を足しました",
        }),
    })
    const revisedPrompt = await runPromptRevision(
      {
        promptId: fixture.prompt.id,
        instruction: "途中式も評価して",
        samples: [
          { examStudentId: examStudentIds()[0], attemptId: attempt.id },
        ],
        provider: "anthropic",
        model: "claude-test",
        effort: "high",
      },
      fixture.exam.user.id,
      createTestDependencies(revisionFake.provider, fixture.dataDirectory)
    )

    expect(revisedPrompt).toMatchObject({
      parentPromptId: fixture.prompt.id,
      cropRegionId: fixture.cropRegion.id,
      createdByUserId: fixture.exam.user.id,
      rubricText: "因数分解で2点、途中式があれば4点、解がそろって満点。",
      revisionInstruction: "途中式も評価して",
      revisionMessage: "途中式の配点を足しました",
    })
    const [revisionRequest] = revisionFake.gradeRequests
    const variableText = JSON.stringify(revisionRequest.variableParts)
    expect(variableText).toContain("途中式も評価して")
    expect(variableText).toContain(
      "この答案は AI 3点・教員4点、教員のコメント：途中式があれば4点"
    )
    expect(revisionRequest.variableParts.map((part) => part.kind)).toEqual([
      "text",
      "image",
    ])

    const revisionRun = await testPrisma.aiGradingRun.findFirstOrThrow({
      where: { purpose: "revise" },
    })
    expect(revisionRun).toMatchObject({
      status: "ended",
      resultPromptId: revisedPrompt.id,
      promptId: fixture.prompt.id,
      inputTokens: 100,
    })
    // 元のプロンプトは書き換えない
    const originalPrompt = await testPrisma.aiPrompt.findUniqueOrThrow({
      where: { id: fixture.prompt.id },
    })
    expect(originalPrompt.rubricText).toBe(fixture.prompt.rubricText)
  })

  it("応答を読めなければ run を failed にし、プロンプトを作らない", async () => {
    const revisionFake = createFakeProvider({
      respond: async () => completedResponse({ questionText: "だけ" }),
    })
    await expect(
      runPromptRevision(
        {
          promptId: fixture.prompt.id,
          instruction: "直して",
          samples: [],
          provider: "anthropic",
          model: "claude-test",
          effort: "high",
        },
        fixture.exam.user.id,
        createTestDependencies(revisionFake.provider, fixture.dataDirectory)
      )
    ).rejects.toThrow("改訂の応答を読めませんでした")

    expect(await testPrisma.aiPrompt.count()).toBe(1)
    const revisionRun = await testPrisma.aiGradingRun.findFirstOrThrow({
      where: { purpose: "revise" },
    })
    expect(revisionRun.status).toBe("failed")
  })
})
