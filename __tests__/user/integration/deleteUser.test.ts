/**
 * 利用者の削除（#1140）
 *
 * 利用者を消すと、その利用者のデータも外部キーのカスケードで一緒に消える
 * （docs/ownership-and-sharing-design.md §4.4）。実行者の記録（招待した人・担当を
 * 割り当てた人・成績を確定した人・返却版を記録した人）は行を残して null にする。
 *
 * ここで固定すること:
 * - 採点結果・注釈・確定・複合採点・解答用紙・試験への参加・設問の担当が消える
 * - 実行者の記録4つは行が残り、参照だけ null になる
 * - 確認ダイアログに見せる件数（main が数える）
 * - ログイン中の本人・ただ1人の所有者の試験がある利用者は断る
 * - 見せた後に件数が増えていたら中止する（`deleteAfterRecount`）
 * - 監査ログに消した利用者の名前が残る
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

/** ログイン中の利用者（テストごとに差し替える） */
const loggedIn = vi.hoisted(() => ({ userId: null as string | null }))
vi.mock("../../../electron-src/lib/prisma/auditActor", () => ({
  getCurrentActorUserId: () => loggedIn.userId,
}))

import {
  deleteUser,
  getUserDeletionCounts,
} from "@/electron-src/lib/prisma/user"
import { DELETION_COUNT_NAME } from "@/lib/shared/deletionCountNames"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  createTestUser,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

/**
 * 利用者 A が採点した試験と、A のデータ一式を作る。
 *
 * B は同じ試験のもう1人の所有者で、ログイン中の利用者。A を消しても B と試験は残る。
 */
async function buildScenario() {
  const exam = await createFullTestExam(testPrisma, {
    pageCount: 1,
    cropRegionsPerPage: 2,
    studentCount: 2,
    includeScores: true,
    includeAnnotations: true,
  })
  const userA = exam.user
  const userB = await createTestUser({ name: "利用者B" })
  loggedIn.userId = userB.id

  const [examStudentFirst, examStudentSecond] = exam.examStudents
  const [regionFirst, regionSecond] = exam.cropRegions

  // B は A に招待された、もう1人の所有者
  const userExamB = await testPrisma.userExam.create({
    data: {
      userId: userB.id,
      examId: exam.exam.id,
      role: "OWNER",
      invitedBy: userA.id,
    },
  })

  await testPrisma.scoreDecision.create({
    data: {
      cropRegionId: regionFirst.id,
      examStudentId: examStudentFirst.id,
      verdict: "correct",
      decidedByUserId: userA.id,
    },
  })

  const compoundAnswer = await testPrisma.compoundAnswer.create({
    data: {
      examPageId: exam.pages[0].id,
      label: "アイ",
      answerFormat: "multi-digit",
      correctAnswer: "42",
    },
  })
  await testPrisma.compoundAnswerScore.create({
    data: {
      compoundAnswerId: compoundAnswer.id,
      examStudentId: examStudentFirst.id,
      userId: userA.id,
      status: "correct",
    },
  })

  await testPrisma.asbDefinition.create({
    data: { name: "A の解答用紙", userId: userA.id },
  })

  // A の担当（B が割り当てた）と、B の担当（A が割り当てた）
  await testPrisma.cropRegionAssignment.create({
    data: {
      cropRegionId: regionFirst.id,
      userId: userA.id,
      assignedBy: userB.id,
    },
  })
  const assignmentB = await testPrisma.cropRegionAssignment.create({
    data: {
      cropRegionId: regionSecond.id,
      userId: userB.id,
      assignedBy: userA.id,
    },
  })

  const returnSnapshot = await testPrisma.returnSnapshot.create({
    data: {
      examStudentId: examStudentSecond.id,
      scoresJson: "{}",
      capturedByUserId: userA.id,
    },
  })

  const grade = await testPrisma.grade.create({ data: { name: "成績" } })
  const gradeItem = await testPrisma.gradeItem.create({
    data: { gradeId: grade.id, name: "評定" },
  })
  const gradeStudent = await testPrisma.gradeStudent.create({
    data: { gradeId: grade.id, studentId: exam.students[0].id },
  })
  const frozenScore = await testPrisma.gradeFrozenScore.create({
    data: {
      gradeStudentId: gradeStudent.id,
      gradeItemId: gradeItem.id,
      weightedMaxScore: 100,
      frozenByUserId: userA.id,
    },
  })

  return {
    exam,
    userA,
    userB,
    userExamB,
    assignmentB,
    returnSnapshot,
    frozenScore,
  }
}

describe("利用者の削除", () => {
  beforeEach(async () => {
    loggedIn.userId = null
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("消えるものを数える（0件の項目は出さない）", async () => {
    const { userA, userB } = await buildScenario()

    expect(await getUserDeletionCounts(userA.id)).toEqual([
      { countedName: DELETION_COUNT_NAME.userQuestionScore, shownCount: 4 },
      { countedName: DELETION_COUNT_NAME.drawingAnnotation, shownCount: 1 },
      { countedName: DELETION_COUNT_NAME.scoreDecision, shownCount: 1 },
      { countedName: DELETION_COUNT_NAME.scoredCompoundAnswer, shownCount: 1 },
      { countedName: DELETION_COUNT_NAME.answerSheetDefinition, shownCount: 1 },
      { countedName: DELETION_COUNT_NAME.examMembership, shownCount: 1 },
      { countedName: DELETION_COUNT_NAME.cropRegionAssignment, shownCount: 1 },
    ])
    expect(await getUserDeletionCounts(userB.id)).toEqual([
      { countedName: DELETION_COUNT_NAME.examMembership, shownCount: 1 },
      { countedName: DELETION_COUNT_NAME.cropRegionAssignment, shownCount: 1 },
    ])
  })

  it("採点系・解答用紙・参加・担当が消え、実行者の記録は残って null になる", async () => {
    const {
      exam,
      userA,
      userB,
      userExamB,
      assignmentB,
      returnSnapshot,
      frozenScore,
    } = await buildScenario()

    await deleteUser(userA.id, await getUserDeletionCounts(userA.id))

    expect(
      await testPrisma.user.findUnique({ where: { id: userA.id } })
    ).toBeNull()
    expect(
      await testPrisma.questionScore.count({ where: { userId: userA.id } })
    ).toBe(0)
    expect(await testPrisma.drawingAnnotation.count()).toBe(0)
    expect(await testPrisma.scoreDecision.count()).toBe(0)
    expect(await testPrisma.compoundAnswerScore.count()).toBe(0)
    expect(await testPrisma.asbDefinition.count()).toBe(0)
    expect(
      await testPrisma.userExam.count({ where: { userId: userA.id } })
    ).toBe(0)
    expect(
      await testPrisma.cropRegionAssignment.count({
        where: { userId: userA.id },
      })
    ).toBe(0)

    // 消したのは A なので、試験と B の参加・担当は残る（記録者だけ null）
    expect(
      await testPrisma.exam.findUnique({ where: { id: exam.exam.id } })
    ).not.toBeNull()
    expect(
      await testPrisma.userExam.findUnique({ where: { id: userExamB.id } })
    ).toMatchObject({ userId: userB.id, role: "OWNER", invitedBy: null })
    expect(
      await testPrisma.cropRegionAssignment.findUnique({
        where: { id: assignmentB.id },
      })
    ).toMatchObject({ userId: userB.id, assignedBy: null })
    expect(
      await testPrisma.returnSnapshot.findUnique({
        where: { id: returnSnapshot.id },
      })
    ).toMatchObject({ capturedByUserId: null })
    expect(
      await testPrisma.gradeFrozenScore.findUnique({
        where: { id: frozenScore.id },
      })
    ).toMatchObject({ frozenByUserId: null })

    // 監査ログ: 操作者は B、消した利用者の名前を target に残す
    const auditLogs = await testPrisma.auditLog.findMany({
      where: { action: "user.delete" },
    })
    expect(auditLogs).toHaveLength(1)
    expect(auditLogs[0]).toMatchObject({
      userId: userB.id,
      entityType: "User",
      entityId: userA.id,
      summary: `ユーザー「${userA.name}」を削除しました`,
    })
  })

  it("ログイン中の本人は消さない", async () => {
    const { userA } = await buildScenario()
    loggedIn.userId = userA.id

    await expect(
      deleteUser(userA.id, await getUserDeletionCounts(userA.id))
    ).rejects.toThrow("ログイン中の利用者は削除できません")

    expect(
      await testPrisma.user.findUnique({ where: { id: userA.id } })
    ).not.toBeNull()
    expect(
      await testPrisma.questionScore.count({ where: { userId: userA.id } })
    ).toBe(4)
  })

  it("ただ1人の所有者になっている試験があれば、試験名を示して断る", async () => {
    const exam = await createFullTestExam(testPrisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      studentCount: 1,
      examName: "一人で持っている試験",
    })
    const otherUser = await createTestUser({ name: "別の利用者" })
    loggedIn.userId = otherUser.id
    // 所有者でない参加者が居ても、所有者が1人なら断る
    await testPrisma.userExam.create({
      data: { userId: otherUser.id, examId: exam.exam.id, role: "EDITOR" },
    })

    await expect(
      deleteUser(exam.user.id, await getUserDeletionCounts(exam.user.id))
    ).rejects.toThrow(/一人で持っている試験/)

    expect(
      await testPrisma.user.findUnique({ where: { id: exam.user.id } })
    ).not.toBeNull()
    expect(
      await testPrisma.userExam.count({ where: { examId: exam.exam.id } })
    ).toBe(2)
  })

  it("見せた後に件数が増えていたら中止し、何も消さない", async () => {
    const { userA } = await buildScenario()
    const shownCounts = await getUserDeletionCounts(userA.id)

    // 押すまでの間に、A の解答用紙が同期で届いた
    await testPrisma.asbDefinition.create({
      data: { name: "後から届いた解答用紙", userId: userA.id },
    })

    await expect(deleteUser(userA.id, shownCounts)).rejects.toThrow(
      /解答用紙 1件 → 2件/
    )

    expect(
      await testPrisma.user.findUnique({ where: { id: userA.id } })
    ).not.toBeNull()
    expect(await testPrisma.asbDefinition.count()).toBe(2)
    expect(
      await testPrisma.auditLog.count({ where: { action: "user.delete" } })
    ).toBe(0)
  })
})
