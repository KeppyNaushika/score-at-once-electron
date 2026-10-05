/**
 * 受験生徒ごとの採点担当（setExamStudentAssignments / getExamStudentAssignmentsForExam）
 * 統合テスト（docs/scoring-scope-and-permissions-design.md §3-1）
 *
 * 固定するのは main の約束:
 * - 担当を変えられるのは試験の OWNER だけ。割当先は試験のメンバーだけ
 * - 別の試験の受験生徒へは書かない
 * - 既にその姿の生徒には書かない（返す数は実際に変えた数）
 * - 取得はメンバーでなくなった担当者を落とす（行は残す）
 * - 受験生を外せば担当も一緒に消える
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

import {
  getExamStudentAssignmentsForExam,
  setExamStudentAssignments,
} from "@/electron-src/lib/prisma/examStudentAssignment"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

/** 採点者を作る。試験を渡せば、その試験のメンバー（採点者）にする */
async function createGrader(name: string, examId: string | null) {
  const user = await testPrisma.user.create({
    data: {
      id: crypto.randomUUID(),
      username: `grader_${crypto.randomUUID()}`,
      name,
      role: "teacher",
    },
  })
  if (examId) {
    await testPrisma.userExam.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        examId,
        role: "EDITOR",
      },
    })
  }
  return user
}

describe("受験生徒ごとの採点担当", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("OWNER は採点者に生徒をまとめて割り当て、外せる", async () => {
    const fixture = await createFullTestExam(testPrisma, { studentCount: 3 })
    const grader = await createGrader("採点者", fixture.exam.id)
    const examStudentIds = fixture.examStudents.map(
      (examStudent) => examStudent.id
    )

    const assignedCount = await setExamStudentAssignments({
      examId: fixture.exam.id,
      userId: grader.id,
      examStudentIds: examStudentIds.slice(0, 2),
      assigned: true,
      requestedByUserId: fixture.user.id,
    })
    expect(assignedCount).toBe(2)

    const assignments = await getExamStudentAssignmentsForExam(fixture.exam.id)
    expect(
      assignments.map((assignment) => assignment.examStudentId).sort()
    ).toEqual(examStudentIds.slice(0, 2).sort())
    for (const assignment of assignments) {
      expect(assignment.userId).toBe(grader.id)
      expect(assignment.assignedBy).toBe(fixture.user.id)
      // 担当者は同梱するが、パスコードは渡さない
      expect(assignment.user.name).toBe("採点者")
      expect(assignment.user).not.toHaveProperty("passcode")
    }

    const unassignedCount = await setExamStudentAssignments({
      examId: fixture.exam.id,
      userId: grader.id,
      examStudentIds: [examStudentIds[0]],
      assigned: false,
      requestedByUserId: fixture.user.id,
    })
    expect(unassignedCount).toBe(1)
    expect(
      (await getExamStudentAssignmentsForExam(fixture.exam.id)).map(
        (assignment) => assignment.examStudentId
      )
    ).toEqual([examStudentIds[1]])
  })

  it("既にその姿の生徒には書かず、変えた数だけを返す", async () => {
    const fixture = await createFullTestExam(testPrisma, { studentCount: 3 })
    const grader = await createGrader("採点者", fixture.exam.id)
    const [firstId, secondId] = fixture.examStudents.map(
      (examStudent) => examStudent.id
    )
    await setExamStudentAssignments({
      examId: fixture.exam.id,
      userId: grader.id,
      examStudentIds: [firstId],
      assigned: true,
      requestedByUserId: fixture.user.id,
    })
    const before = await testPrisma.examStudentAssignment.findFirstOrThrow({
      where: { examStudentId: firstId },
    })

    // 1人は既に担当。もう1人だけが増える
    const assignedCount = await setExamStudentAssignments({
      examId: fixture.exam.id,
      userId: grader.id,
      examStudentIds: [firstId, secondId],
      assigned: true,
      requestedByUserId: fixture.user.id,
    })
    expect(assignedCount).toBe(1)
    const after = await testPrisma.examStudentAssignment.findFirstOrThrow({
      where: { examStudentId: firstId },
    })
    // 既にあった行は書き直さない（同期に無駄な更新を流さない）
    expect(after.updatedAt).toEqual(before.updatedAt)

    // 担当でない生徒を外しても何も起きない
    const [, , thirdId] = fixture.examStudents.map(
      (examStudent) => examStudent.id
    )
    expect(
      await setExamStudentAssignments({
        examId: fixture.exam.id,
        userId: grader.id,
        examStudentIds: [thirdId],
        assigned: false,
        requestedByUserId: fixture.user.id,
      })
    ).toBe(0)
  })

  it("OWNER でない人は担当を変えられない", async () => {
    const fixture = await createFullTestExam(testPrisma, { studentCount: 1 })
    const grader = await createGrader("採点者", fixture.exam.id)

    await expect(
      setExamStudentAssignments({
        examId: fixture.exam.id,
        userId: grader.id,
        examStudentIds: [fixture.examStudents[0].id],
        assigned: true,
        requestedByUserId: grader.id,
      })
    ).rejects.toThrow()
    expect(await testPrisma.examStudentAssignment.count()).toBe(0)
  })

  it("試験のメンバーでない人には割り当てられない", async () => {
    const fixture = await createFullTestExam(testPrisma, { studentCount: 1 })
    const outsider = await createGrader("部外者", null)

    await expect(
      setExamStudentAssignments({
        examId: fixture.exam.id,
        userId: outsider.id,
        examStudentIds: [fixture.examStudents[0].id],
        assigned: true,
        requestedByUserId: fixture.user.id,
      })
    ).rejects.toThrow("この試験のメンバーでないユーザーには割り当てられません")
  })

  it("別の試験の受験生徒へは書かない", async () => {
    const fixture = await createFullTestExam(testPrisma, { studentCount: 1 })
    const otherFixture = await createFullTestExam(testPrisma, {
      studentCount: 1,
    })
    const grader = await createGrader("採点者", fixture.exam.id)

    const assignedCount = await setExamStudentAssignments({
      examId: fixture.exam.id,
      userId: grader.id,
      examStudentIds: [otherFixture.examStudents[0].id],
      assigned: true,
      requestedByUserId: fixture.user.id,
    })
    expect(assignedCount).toBe(0)
    expect(await testPrisma.examStudentAssignment.count()).toBe(0)
  })

  it("メンバーでなくなった担当者は取得から落とし、行は残す", async () => {
    const fixture = await createFullTestExam(testPrisma, { studentCount: 1 })
    const grader = await createGrader("採点者", fixture.exam.id)
    await setExamStudentAssignments({
      examId: fixture.exam.id,
      userId: grader.id,
      examStudentIds: [fixture.examStudents[0].id],
      assigned: true,
      requestedByUserId: fixture.user.id,
    })

    await testPrisma.userExam.deleteMany({
      where: { userId: grader.id, examId: fixture.exam.id },
    })

    expect(await getExamStudentAssignmentsForExam(fixture.exam.id)).toEqual([])
    // 招待し直せば戻るよう、行そのものは消さない
    expect(await testPrisma.examStudentAssignment.count()).toBe(1)
  })

  it("受験生を外すと担当も一緒に消える", async () => {
    const fixture = await createFullTestExam(testPrisma, { studentCount: 1 })
    const grader = await createGrader("採点者", fixture.exam.id)
    await setExamStudentAssignments({
      examId: fixture.exam.id,
      userId: grader.id,
      examStudentIds: [fixture.examStudents[0].id],
      assigned: true,
      requestedByUserId: fixture.user.id,
    })

    await testPrisma.examStudent.delete({
      where: { id: fixture.examStudents[0].id },
    })

    expect(await testPrisma.examStudentAssignment.count()).toBe(0)
  })
})
