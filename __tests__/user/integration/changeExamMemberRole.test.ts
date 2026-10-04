/**
 * 試験の参加者の役割変更（採点者 ⇄ オーナー）
 *
 * オーナーを別の教員へ移すには、相手をオーナーにしてから自分を採点者へ戻す。
 * 利用者の削除は、その利用者だけがオーナーの試験があると断るので、その前の手段になる。
 *
 * ここで固定すること:
 * - オーナーは採点者をオーナーにでき、オーナーを採点者へ戻せる（自分も含む）
 * - 最後の1人のオーナーは採点者へ戻せない
 * - オーナー以外（採点者・ログインしていない）は変えられない。操作者は main が決める
 * - 監査ログに役割の変更が残る
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

import { changeExamMemberRole } from "@/electron-src/lib/prisma/userExam"

import { createFullTestExam } from "../../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  createTestUser,
  disconnectTestPrisma,
} from "../../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

/** オーナー A と採点者 B が参加する試験。ログイン中は A */
async function buildExam() {
  const exam = await createFullTestExam(testPrisma, {
    pageCount: 1,
    cropRegionsPerPage: 1,
    studentCount: 1,
    includeScores: false,
  })
  const owner = exam.user
  const grader = await createTestUser({ name: "採点者B" })
  await testPrisma.userExam.create({
    data: {
      userId: grader.id,
      examId: exam.exam.id,
      role: "GRADER",
      invitedBy: owner.id,
    },
  })
  loggedIn.userId = owner.id
  return { examId: exam.exam.id, owner, grader }
}

const roleOf = async (examId: string, userId: string) =>
  (
    await testPrisma.userExam.findUnique({
      where: { userId_examId: { userId, examId } },
    })
  )?.role

describe("試験の参加者の役割変更", () => {
  beforeEach(async () => {
    loggedIn.userId = null
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await cleanupTestDatabase()
    await testPrisma.$disconnect()
    await disconnectTestPrisma()
  })

  it("オーナーが採点者をオーナーにでき、監査ログが残る", async () => {
    const { examId, grader } = await buildExam()

    const updated = await changeExamMemberRole(examId, grader.id, "OWNER")

    expect(updated).toMatchObject({ userId: grader.id, role: "OWNER" })
    expect(updated.user.name).toBe("採点者B")
    expect(await roleOf(examId, grader.id)).toBe("OWNER")

    const auditLogs = await testPrisma.auditLog.findMany({
      where: { action: "exam.user.role_update" },
    })
    expect(auditLogs).toHaveLength(1)
    expect(auditLogs[0]).toMatchObject({
      entityType: "UserExam",
      entityId: updated.id,
      scopeId: examId,
      summary: "「採点者B」をオーナーにしました",
    })
  })

  it("相手をオーナーにしてから自分を採点者へ戻せる（オーナーを移す）", async () => {
    const { examId, owner, grader } = await buildExam()

    await changeExamMemberRole(examId, grader.id, "OWNER")
    await changeExamMemberRole(examId, owner.id, "GRADER")

    expect(await roleOf(examId, owner.id)).toBe("GRADER")
    expect(await roleOf(examId, grader.id)).toBe("OWNER")
  })

  it("オーナーが2人いれば、他のオーナーも採点者へ戻せる", async () => {
    const { examId, grader } = await buildExam()
    await changeExamMemberRole(examId, grader.id, "OWNER")

    await changeExamMemberRole(examId, grader.id, "GRADER")

    expect(await roleOf(examId, grader.id)).toBe("GRADER")
  })

  it("最後の1人のオーナーは採点者へ戻せない", async () => {
    const { examId, owner } = await buildExam()

    await expect(
      changeExamMemberRole(examId, owner.id, "GRADER")
    ).rejects.toThrow(/最後のオーナーは採点者に戻せません/)

    expect(await roleOf(examId, owner.id)).toBe("OWNER")
  })

  it("オーナーでない利用者は役割を変えられない", async () => {
    const { examId, grader } = await buildExam()
    loggedIn.userId = grader.id

    await expect(
      changeExamMemberRole(examId, grader.id, "OWNER")
    ).rejects.toThrow(/この試験のオーナーだけです/)

    expect(await roleOf(examId, grader.id)).toBe("GRADER")
  })

  it("参加していない利用者・ログインしていない操作は断る", async () => {
    const { examId, owner } = await buildExam()
    const outsider = await createTestUser({ name: "参加していない人" })

    await expect(
      changeExamMemberRole(examId, outsider.id, "OWNER")
    ).rejects.toThrow(/参加者ではありません/)

    loggedIn.userId = null
    await expect(
      changeExamMemberRole(examId, owner.id, "OWNER")
    ).rejects.toThrow(/ログインしている利用者が分からない/)
  })
})
