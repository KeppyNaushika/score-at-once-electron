/**
 * 採点の監査ログが、生徒と採点領域を対象（AuditLogTarget）に持つことの検証。
 *
 * 採点はいちばん件数の多い操作で、対象が無いと「採点を提案しました」が並ぶだけで
 * 誰のどの設問か分からない（docs/audit-log-redesign.md）。ここで固定するのは3つ。
 *
 * - 生徒は `Student.id` で記録する（`ExamStudent.id` ではない。成績・資料と軸を揃える）
 * - 要約に生徒名と採点領域のラベルが載る（全文検索で引ける）
 * - 生徒で絞り込むと、その生徒の採点のログが引ける
 *
 * あわせて、差分の表示が採点状態の正規の呼び名（`SCORING_STATUS_LABELS`）を使い、類型を付けた
 * 採点は状態名でなく類型の記号を出すことも固定する（#1492）。
 *
 * 類型の書き込み（`setScaleLevels`）は複数の生徒をまとめて受けるが、ログは正誤と同じく
 * 採点行1件ごとに、生徒と設問を対象に、採点の前後を差分に持つ。
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
import { setScaleLevels } from "@/electron-src/lib/prisma/scaleLevelScoreWrite"

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

  it("差分は採点状態の正規の呼び名で出し、類型を付けた採点の変更前は類型の記号を出す", async () => {
    const examStudent = fixture.examStudents[0]
    const cropRegion = fixture.cropRegions[0]
    const scoreScale = await testPrisma.scoreScale.create({
      data: {
        examId: fixture.exam.id,
        name: "記述の類型",
        levels: { create: [{ label: "A", score: 10, sortOrder: 0 }] },
      },
      include: { levels: true },
    })
    const evaluated = await testPrisma.questionScore.create({
      data: {
        examStudentId: examStudent.id,
        cropRegionId: cropRegion.id,
        userId: fixture.user.id,
        status: "evaluated",
        scaleLevelId: scoreScale.levels[0].id,
      },
    })

    await updateQuestionScore(evaluated.id, {
      status: "no_answer",
      partialScore: null,
    })
    await updateQuestionScore(evaluated.id, {
      status: "double_mark",
      partialScore: null,
    })

    const page = await getAuditLogs()
    const statusChanges = page.logs
      .flatMap(
        (log) =>
          (
            JSON.parse(log.metadata ?? "{}") as {
              changes?: { field: string; before: unknown; after: unknown }[]
            }
          ).changes ?? []
      )
      .filter((change) => change.field === "status")
      .map((change) => [change.before, change.after])
    expect(statusChanges).toContainEqual(["A", "無答"])
    expect(statusChanges.flat()).toContain("Wマーク")
  })

  it("類型をまとめて付け・付け替え・外しても、採点行1件ごとに生徒と前後の差分を残す", async () => {
    const [firstExamStudent, secondExamStudent] = fixture.examStudents
    const cropRegion = fixture.cropRegions[0]
    const scoreScale = await testPrisma.scoreScale.create({
      data: {
        examId: fixture.exam.id,
        name: "記述の類型",
        levels: {
          create: [
            { label: "A", score: 10, sortOrder: 0 },
            { label: "B", score: 6, sortOrder: 1 },
          ],
        },
      },
      include: { levels: { orderBy: { sortOrder: "asc" } } },
    })
    const [levelA, levelB] = scoreScale.levels
    await testPrisma.cropRegion.update({
      where: { id: cropRegion.id },
      data: { scoringMethod: "scale", scoreScaleId: scoreScale.id },
    })
    await testPrisma.questionScore.create({
      data: {
        examStudentId: firstExamStudent.id,
        cropRegionId: cropRegion.id,
        userId: fixture.user.id,
        status: "pending",
        partialScore: 3,
      },
    })
    const students = await testPrisma.student.findMany({
      where: {
        id: {
          in: [firstExamStudent.studentId, secondExamStudent.studentId],
        },
      },
    })
    const studentLabelOf = (studentId: string) => {
      const student = students.find((candidate) => candidate.id === studentId)
      return `${student?.lastName} ${student?.firstName}`.trim()
    }

    const bothExamStudentIds = [firstExamStudent.id, secondExamStudent.id]
    await setScaleLevels(
      {
        cropRegionId: cropRegion.id,
        examStudentIds: bothExamStudentIds,
        scaleLevelId: levelA.id,
      },
      fixture.user.id
    )
    await setScaleLevels(
      {
        cropRegionId: cropRegion.id,
        examStudentIds: [firstExamStudent.id],
        scaleLevelId: levelB.id,
      },
      fixture.user.id
    )
    await setScaleLevels(
      {
        cropRegionId: cropRegion.id,
        examStudentIds: bothExamStudentIds,
        scaleLevelId: null,
      },
      fixture.user.id
    )

    const statusChangesOf = async (studentId: string) => {
      const page = await getAuditLogs({
        targets: [{ targetType: "Student", targetId: studentId }],
      })
      for (const log of page.logs) {
        expect(log.summary).toContain(studentLabelOf(studentId))
        expect(log.summary).toContain(cropRegion.label)
        expect(log.targets.map((target) => target.targetType).sort()).toEqual([
          "CropRegion",
          "Student",
        ])
      }
      return page.logs.map((log) => {
        const statusChange = (
          JSON.parse(log.metadata ?? "{}") as {
            changes?: { field: string; before: unknown; after: unknown }[]
          }
        ).changes?.find((change) => change.field === "status")
        return [log.action, statusChange?.before, statusChange?.after]
      })
    }

    // 並びは更新時刻の降順で、同じミリ秒に書いた行は順が決まらないので、順を問わずに比べる
    const firstChanges = await statusChangesOf(firstExamStudent.studentId)
    expect(firstChanges).toHaveLength(3)
    expect(firstChanges).toEqual(
      expect.arrayContaining([
        ["exam.score.evaluate", "保留", "A"],
        ["exam.score.evaluate", "A", "B"],
        ["exam.score.update", "B", "未採点"],
      ])
    )
    const secondChanges = await statusChangesOf(secondExamStudent.studentId)
    expect(secondChanges).toHaveLength(2)
    expect(secondChanges).toEqual(
      expect.arrayContaining([
        ["exam.score.evaluate", null, "A"],
        ["exam.score.update", "A", "未採点"],
      ])
    )
  })
})
