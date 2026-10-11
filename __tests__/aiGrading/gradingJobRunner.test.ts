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
import { GradingProviderError } from "@/electron-src/lib/aiGrading/providers/providerShared"
import type { ProviderGradingResponse } from "@/electron-src/lib/aiGrading/providers/types"
import { STAGE1_TEMPLATE_VERSION } from "@/lib/shared/aiGrading/stage1Grading"

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
  purpose: "grade" as const,
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

describe("採点チェック", () => {
  it("教員の採点は送らず、1段目だけを走らせて2段目を続けない", async () => {
    const teacherComment = "先生だけが知っている採点の理由"
    for (const examStudent of fixture.exam.examStudents) {
      await testPrisma.questionScore.create({
        data: {
          examStudentId: examStudent.id,
          cropRegionId: fixture.cropRegion.id,
          userId: fixture.exam.user.id,
          status: "partial",
          partialScore: 4.25,
          comment: teacherComment,
        },
      })
    }
    const { provider, gradeRequests, groupingRequests } = createFakeProvider({
      respond: async () => completedResponse(PARTIAL_JUDGEMENT),
    })
    const runner = createGradingJobRunner(
      createTestDependencies(provider, fixture.dataDirectory)
    )
    const { run, finished } = await runner.startGradingRun(
      { ...startInput(), purpose: "check" },
      fixture.exam.user.id
    )
    await finished

    const storedRun = await testPrisma.aiGradingRun.findUniqueOrThrow({
      where: { id: run.id },
    })
    expect(storedRun).toMatchObject({ purpose: "check", status: "ended" })
    expect(gradeRequests).toHaveLength(3)
    // 送った文面に教員の判定・点・理由が入っていない
    gradeRequests.forEach((request) => {
      const sentText = JSON.stringify([
        request.systemText,
        request.fixedParts,
        request.variableParts.filter((part) => part.kind !== "image"),
      ])
      expect(sentText).not.toContain(teacherComment)
      expect(sentText).not.toContain("4.25")
    })
    // 2段目は続けない
    expect(groupingRequests).toHaveLength(0)
    expect(
      await testPrisma.aiGradingRun.count({ where: { purpose: "group" } })
    ).toBe(0)
  })
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
      templateVersion: STAGE1_TEMPLATE_VERSION,
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
        comment: "",
        annotationText: "",
        transcription: PARTIAL_JUDGEMENT.transcription,
        observation: PARTIAL_JUDGEMENT.observation,
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

    // 進み具合の最後の通知（1段目のあとに2段目の通知が続くので、1段目の run の分を見る）
    const notifyProgress = vi.mocked(dependencies.notifyProgress)
    const gradeRunProgress = notifyProgress.mock.calls
      .map(([progress]) => progress)
      .filter((progress) => progress.runId === run.id)
    expect(gradeRunProgress.at(-1)).toMatchObject({
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
      observation: PARTIAL_JUDGEMENT.observation,
    })
    expect(attemptById.get(thirdAttempt.id)?.state).toBe("expired")
    const collectedRun = await testPrisma.aiGradingRun.findUniqueOrThrow({
      where: { id: run.id },
    })
    expect(collectedRun.status).toBe("ended")
    expect(endedFake.cleanupBatch).toHaveBeenCalledWith("batch_fake_1")
    // 回収したら、そのまま2段目（項目の案）を続ける
    expect(endedFake.groupingRequests).toHaveLength(1)
    expect(
      await testPrisma.aiGradingRun.count({ where: { purpose: "group" } })
    ).toBe(1)

    // 取り込み済みの run は2度取り込まない
    await endedCollector.pollOnce()
    expect(endedFake.cleanupBatch).toHaveBeenCalledTimes(1)
  })
})
