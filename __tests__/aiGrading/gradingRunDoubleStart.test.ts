/**
 * 採点の実行の2重開始の防止（main 側の多重防御）。
 *
 * 画面がダブルクリックを止め損ねても、同じ教員・同じプロンプト・同じ答案の組の実行が
 * 開始の処理中なら、2つ目を拒む（外部へ2回送らない）。前の開始が終わってからの再実行や、
 * 別の答案の組での実行は妨げない。
 *
 * 外部へは何も送らない（偽の事業者）。答案画像は合成した PNG。
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

const startInput = (
  overrides: { mode?: "realtime" | "batch"; examStudentIds?: string[] } = {}
) => ({
  purpose: "grade" as const,
  promptId: fixture.prompt.id,
  examStudentIds: overrides.examStudentIds ?? examStudentIds(),
  provider: "anthropic" as const,
  model: "claude-test",
  effort: "medium" as const,
  mode: overrides.mode ?? "realtime",
  imageScale: 1,
})

const DOUBLE_START_MESSAGE = /同じ答案の AI 採点を始めているところです/

describe("2重の開始", () => {
  it("開始の処理中に同じ実行が来たら2つ目を拒み、外部へは1回分だけ送る", async () => {
    const { provider, gradeRequests } = createFakeProvider({
      respond: async () => completedResponse(PARTIAL_JUDGEMENT),
    })
    const runner = createGradingJobRunner(
      createTestDependencies(provider, fixture.dataDirectory)
    )

    // ダブルクリック: 1つ目を待たずに2つ目を呼ぶ。答案の並び順が違っても同じ組
    const firstStart = runner.startGradingRun(
      startInput(),
      fixture.exam.user.id
    )
    const secondStart = runner.startGradingRun(
      startInput({ examStudentIds: [...examStudentIds()].reverse() }),
      fixture.exam.user.id
    )

    await expect(secondStart).rejects.toThrow(DOUBLE_START_MESSAGE)
    const { finished } = await firstStart
    await finished

    expect(
      await testPrisma.aiGradingRun.count({ where: { purpose: "grade" } })
    ).toBe(1)
    expect(gradeRequests).toHaveLength(3)
  })

  it("バッチでも、預け終わるまでの2つ目を拒む", async () => {
    const { provider, submittedBatches } = createFakeProvider({})
    const runner = createGradingJobRunner(
      createTestDependencies(provider, fixture.dataDirectory)
    )

    const firstStart = runner.startGradingRun(
      startInput({ mode: "batch" }),
      fixture.exam.user.id
    )
    const secondStart = runner.startGradingRun(
      startInput({ mode: "batch" }),
      fixture.exam.user.id
    )

    await expect(secondStart).rejects.toThrow(DOUBLE_START_MESSAGE)
    await firstStart
    expect(submittedBatches).toHaveLength(1)
    expect(
      await testPrisma.aiGradingRun.count({ where: { purpose: "grade" } })
    ).toBe(1)
  })

  it("前の開始が終わってからの同じ組の再実行は受け付ける", async () => {
    const { provider } = createFakeProvider({
      respond: async () => completedResponse(PARTIAL_JUDGEMENT),
    })
    const runner = createGradingJobRunner(
      createTestDependencies(provider, fixture.dataDirectory)
    )

    const firstRun = await runner.startGradingRun(
      startInput(),
      fixture.exam.user.id
    )
    await firstRun.finished
    const secondRun = await runner.startGradingRun(
      startInput(),
      fixture.exam.user.id
    )
    await secondRun.finished

    expect(secondRun.run.id).not.toBe(firstRun.run.id)
    expect(
      await testPrisma.aiGradingRun.count({ where: { purpose: "grade" } })
    ).toBe(2)
  })

  it("開始が失敗したら、同じ組で再び始められる", async () => {
    const { provider } = createFakeProvider({
      respond: async () => completedResponse(PARTIAL_JUDGEMENT),
    })
    const resolveProvider = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error("API キーが設定されていません")
      })
      .mockImplementation(() => provider)
    const runner = createGradingJobRunner(
      createTestDependencies(provider, fixture.dataDirectory, {
        resolveProvider,
      })
    )

    await expect(
      runner.startGradingRun(startInput(), fixture.exam.user.id)
    ).rejects.toThrow("API キーが設定されていません")
    const { finished } = await runner.startGradingRun(
      startInput(),
      fixture.exam.user.id
    )
    await finished

    expect(
      await testPrisma.aiGradingRun.count({ where: { purpose: "grade" } })
    ).toBe(1)
  })

  it("別の答案の組や別の教員の実行は、同時でも妨げない", async () => {
    const { provider, gradeRequests } = createFakeProvider({
      respond: async () => completedResponse(PARTIAL_JUDGEMENT),
    })
    const runner = createGradingJobRunner(
      createTestDependencies(provider, fixture.dataDirectory)
    )
    const [firstExamStudentId, ...restExamStudentIds] = examStudentIds()

    const startedRuns = await Promise.all([
      runner.startGradingRun(
        startInput({ examStudentIds: [firstExamStudentId] }),
        fixture.exam.user.id
      ),
      runner.startGradingRun(
        startInput({ examStudentIds: restExamStudentIds }),
        fixture.exam.user.id
      ),
      runner.startGradingRun(startInput(), fixture.otherUser.id),
    ])
    await Promise.all(startedRuns.map((startedRun) => startedRun.finished))

    expect(
      await testPrisma.aiGradingRun.count({ where: { purpose: "grade" } })
    ).toBe(3)
    expect(gradeRequests).toHaveLength(6)
  })
})
