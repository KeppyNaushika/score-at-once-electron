/**
 * 採点の監査ログが、生徒と採点領域を対象（AuditLogTarget）に持つことの検証。
 *
 * 採点はいちばん件数の多い操作で、対象が無いと「採点を提案しました」が並ぶだけで
 * 誰のどの設問か分からない（docs/audit-log-redesign.md）。ここで固定するのは3つ。
 *
 * - 生徒は `Student.id` で記録する（`ExamStudent.id` ではない。成績・資料と軸を揃える）
 * - 要約に生徒名と採点領域のラベルが載る（全文検索で引ける）
 * - 生徒で絞り込むと、その生徒の採点のログが引ける
 */

import * as path from "path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_DB_PATH = path.resolve(__dirname, "../../data/test-database.db")

vi.mock("electron", () => ({
  app: { getVersion: () => "test", getAppPath: () => process.cwd() },
}))

vi.mock("../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

vi.mock("../../electron-src/lib/prisma/auditActor", () => ({
  getCurrentActorUserId: () => null,
}))

import { getAuditLogs } from "@/electron-src/lib/prisma/auditQuery"
import {
  setQuestionScore,
  updateQuestionScore,
} from "@/electron-src/lib/prisma/questionScoreWrite"

import { createFullTestExam } from "../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

let fixture: Awaited<ReturnType<typeof createFullTestExam>>

beforeEach(async () => {
  await cleanupTestDatabase()
  fixture = await createFullTestExam(testPrisma, { includeScores: false })
})

afterAll(async () => {
  await disconnectTestPrisma()
  await testPrisma.$disconnect()
})

describe("採点の監査ログの対象", () => {
  it("提案・変更のどちらも、生徒（Student.id）と採点領域を対象に持ち、要約に両方のラベルが載る", async () => {
    const examStudent = fixture.examStudents[0]
    const cropRegion = fixture.cropRegions[0]
    const student = await testPrisma.student.findUniqueOrThrow({
      where: { id: examStudent.studentId },
    })
    const studentLabel = `${student.lastName} ${student.firstName}`.trim()

    const created = await setQuestionScore({
      examStudentId: examStudent.id,
      cropRegionId: cropRegion.id,
      userId: fixture.user.id,
      status: "correct",
      partialScore: null,
    })
    await updateQuestionScore(created.id, {
      status: "incorrect",
      partialScore: null,
    })

    const page = await getAuditLogs()
    expect(page.logs.map((log) => log.action).sort()).toEqual([
      "exam.score.propose",
      "exam.score.update",
    ])
    for (const log of page.logs) {
      expect(
        log.targets
          .map((target) => [
            target.targetType,
            target.targetId,
            target.targetLabel,
          ])
          .sort()
      ).toEqual([
        ["CropRegion", cropRegion.id, cropRegion.label || null],
        ["Student", student.id, studentLabel],
      ])
      expect(log.summary).toContain(studentLabel)
      expect(log.summary).toContain(cropRegion.label)
    }

    const filtered = await getAuditLogs({
      targets: [{ targetType: "Student", targetId: student.id }],
    })
    expect(filtered.total).toBe(2)
  })
})
