/**
 * 試験の参加者の役割変更（オーナー・採点者・閲覧者）と、採点者の結果出力の許可、
 * 参加者を外す規則（docs/scoring-scope-and-permissions-design.md §3-3）
 *
 * オーナーを別の教員へ移すには、相手をオーナーにしてから自分の役割を変える。
 * 利用者の削除は、その利用者だけがオーナーの試験があると断るので、その前の手段になる。
 *
 * ここで固定すること:
 * - オーナーは参加者を3つの役割のどれにでも変えられる（自分も含む）
 * - 最後の1人のオーナーはほかの役割へ変えられず、外せない。オーナーが2人いれば外せる
 * - 採点者の結果出力の許可を、オーナーだけが変えられる
 * - オーナー以外（採点者・ログインしていない）は変えられない。操作者は main が決める
 * - 監査ログに変更が残る
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
  changeExamMemberRole,
  removeExamMember,
  setExamAnonymousScoringEnforced,
  setExamMemberExportPermission,
} from "@/electron-src/lib/prisma/userExam"

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
      role: "EDITOR",
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

afterAll(async () => {
  await cleanupTestDatabase()
  await testPrisma.$disconnect()
  await disconnectTestPrisma()
})

describe("試験の参加者の役割変更", () => {
  beforeEach(async () => {
    loggedIn.userId = null
    await cleanupTestDatabase()
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
    await changeExamMemberRole(examId, owner.id, "EDITOR")

    expect(await roleOf(examId, owner.id)).toBe("EDITOR")
    expect(await roleOf(examId, grader.id)).toBe("OWNER")
  })

  it("採点者を閲覧者にでき、監査ログに閲覧者と残る", async () => {
    const { examId, grader } = await buildExam()

    await changeExamMemberRole(examId, grader.id, "VIEWER")

    expect(await roleOf(examId, grader.id)).toBe("VIEWER")
    const auditLog = await testPrisma.auditLog.findFirst({
      where: { action: "exam.user.role_update" },
    })
    expect(auditLog?.summary).toBe("「採点者B」を閲覧者にしました")
  })

  it("オーナーが2人いれば、他のオーナーも採点者へ戻せる", async () => {
    const { examId, grader } = await buildExam()
    await changeExamMemberRole(examId, grader.id, "OWNER")

    await changeExamMemberRole(examId, grader.id, "EDITOR")

    expect(await roleOf(examId, grader.id)).toBe("EDITOR")
  })

  it("最後の1人のオーナーはほかの役割へ変えられない", async () => {
    const { examId, owner } = await buildExam()

    await expect(
      changeExamMemberRole(examId, owner.id, "VIEWER")
    ).rejects.toThrow(/最後のオーナーはほかの役割に変えられません/)

    expect(await roleOf(examId, owner.id)).toBe("OWNER")
  })

  it("オーナーでない利用者は役割を変えられない", async () => {
    const { examId, grader } = await buildExam()
    loggedIn.userId = grader.id

    await expect(
      changeExamMemberRole(examId, grader.id, "OWNER")
    ).rejects.toThrow(/この試験のオーナーだけです/)

    expect(await roleOf(examId, grader.id)).toBe("EDITOR")
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

  it("最後の1人のオーナーは外せず、オーナーが2人いれば外せる", async () => {
    const { examId, owner, grader } = await buildExam()

    await expect(removeExamMember(examId, owner.id, owner.id)).rejects.toThrow(
      /最後のオーナーは外せません/
    )
    expect(await roleOf(examId, owner.id)).toBe("OWNER")

    await changeExamMemberRole(examId, grader.id, "OWNER")
    await removeExamMember(examId, grader.id, owner.id)
    expect(await roleOf(examId, grader.id)).toBeUndefined()
  })
})

describe("採点者の結果出力の許可", () => {
  beforeEach(async () => {
    loggedIn.userId = null
    await cleanupTestDatabase()
  })

  it("参加したときは許可されていて、オーナーが止められる。監査ログが残る", async () => {
    const { examId, grader } = await buildExam()
    const exportPermissionOf = async () =>
      (
        await testPrisma.userExam.findUnique({
          where: { userId_examId: { userId: grader.id, examId } },
        })
      )?.canExportResults

    // 既定は許可（既存の採点者が結果出力を失わない）
    expect(await exportPermissionOf()).toBe(true)

    await setExamMemberExportPermission(examId, grader.id, false)

    expect(await exportPermissionOf()).toBe(false)
    const auditLog = await testPrisma.auditLog.findFirst({
      where: { action: "exam.user.export_permission_update" },
    })
    expect(auditLog?.summary).toBe("「採点者B」の結果出力を止めました")
  })

  it("オーナーでない利用者は許可を変えられない", async () => {
    const { examId, grader } = await buildExam()
    loggedIn.userId = grader.id

    await expect(
      setExamMemberExportPermission(examId, grader.id, false)
    ).rejects.toThrow(/この試験のオーナーだけです/)
  })
})

describe("匿名採点の固定", () => {
  beforeEach(async () => {
    loggedIn.userId = null
    await cleanupTestDatabase()
  })

  it("オーナーが固定・解除でき、監査ログが残る", async () => {
    const { examId } = await buildExam()
    const enforcedOf = async () =>
      (await testPrisma.exam.findUnique({ where: { id: examId } }))
        ?.anonymousScoringEnforced

    expect(await enforcedOf()).toBe(false)
    await setExamAnonymousScoringEnforced(examId, true)
    expect(await enforcedOf()).toBe(true)
    await setExamAnonymousScoringEnforced(examId, false)
    expect(await enforcedOf()).toBe(false)

    const auditLogs = await testPrisma.auditLog.findMany({
      where: { action: "exam.anonymous_scoring.update" },
      orderBy: { createdAt: "asc" },
    })
    expect(auditLogs).toHaveLength(2)
    expect(auditLogs[0].summary).toMatch(/匿名採点を固定しました/)
  })

  it("オーナーでない利用者は固定を変えられない", async () => {
    const { examId, grader } = await buildExam()
    loggedIn.userId = grader.id

    await expect(setExamAnonymousScoringEnforced(examId, true)).rejects.toThrow(
      /この試験のオーナーだけです/
    )
  })
})
