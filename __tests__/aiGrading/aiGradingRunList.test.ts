/**
 * AI 採点の実行の読み出し（設問ごと・試験ごと。docs/vlm-grading-design.md §10）。
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
  listAiGradingRunsByCropRegion,
  listAiGradingRunsByExam,
} from "@/electron-src/lib/prisma/aiGradingRun"

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

/** 全答案を採点する */
async function gradeAll(actorUserId: string = fixture.exam.user.id) {
  const { provider } = createFakeProvider({
    respond: async () => completedResponse(PARTIAL_JUDGEMENT),
  })
  const runner = createGradingJobRunner(
    createTestDependencies(provider, fixture.dataDirectory)
  )
  const { finished } = await runner.startGradingRun(
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
}

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
  it("試験の設問をたどって、その教員の実行だけを試行と採点指示付きで返す", async () => {
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
