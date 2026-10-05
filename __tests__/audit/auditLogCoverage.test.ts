/**
 * #1387 PR-5 で記録を足した操作の検査。
 *
 * - 設問と小計の対応の付け外し（`exam.subtotal_assignment.update`）: 試験ごとに1行へまとまり、
 *   変更内容は「最初の状態 → 最後の状態」。何も変わらない操作は記録しない
 * - 学級の作成・編集・削除（`class.*`）: 学級を作業領域（scopeId）として記録する
 *
 * 答案の配置（`exam.answer.assign`）は `studentAnswerPlacementApply.test.ts` の側で見る。
 * Electron依存を回避するため prisma/client をテスト用クライアントでモックする。
 */

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../../electron-src/lib/prisma/client", async () => {
  const { getTestPrismaClient } = await import("../helpers/testPrismaClient")
  return {
    default: getTestPrismaClient(),
    getPrismaClient: () => getTestPrismaClient(),
  }
})

// 操作者の自動補完（認証ストア）は常に null を返すようにして、テストを決定的にする
vi.mock("../../electron-src/lib/prisma/auditActor", () => ({
  getCurrentActorUserId: () => null,
}))

import { parseAuditMetadata } from "@/app/(app)/audit-logs/auditLogRow"
import {
  createClassroom,
  deleteClassroom,
  updateClassroom,
} from "@/electron-src/lib/prisma/classroom"
import {
  createCropSubtotal,
  deleteCropSubtotal,
} from "@/electron-src/lib/prisma/cropSubtotal"

import { createFullTestExam } from "../helpers/testExamBuilder"
import {
  cleanupTestDatabase,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../helpers/testPrismaClient"

const prisma = getTestPrismaClient()

afterAll(async () => {
  await cleanupTestDatabase()
  await disconnectTestPrisma()
})

describe("設問と小計の対応の付け外し", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  const assignmentLogs = () =>
    prisma.auditLog.findMany({
      where: { action: "exam.subtotal_assignment.update" },
      include: { targets: true },
    })

  it("外して付け直すと試験ごとに1行へまとまり、対象に採点領域が入る", async () => {
    const exam = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      includeScores: false,
    })
    const [cropSubtotal] = exam.cropSubtotals

    await deleteCropSubtotal(cropSubtotal.id)
    await createCropSubtotal({
      cropRegionId: cropSubtotal.cropRegionId,
      subtotalId: cropSubtotal.subtotalId,
      assignmentType: "QUESTION_ASSIGNMENT",
    })

    const logs = await assignmentLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0].scopeId).toBe(exam.exam.id)
    expect(logs[0].scopeLabel).toBe(exam.exam.examName)
    expect(logs[0].targets.map((target) => target.targetId)).toEqual([
      cropSubtotal.cropRegionId,
    ])
    const metadata = parseAuditMetadata(logs[0].metadata)
    expect(metadata.occurrences).toBe(2)
    // 最初の状態（対応あり）→ 最後の状態（対応あり）
    expect(metadata.changes).toEqual([
      expect.objectContaining({ before: "対応あり", after: "対応あり" }),
    ])
  })

  it("既に在る対応を付ける・既に消えた対応を外すのは記録しない", async () => {
    const exam = await createFullTestExam(prisma, {
      pageCount: 1,
      cropRegionsPerPage: 1,
      includeScores: false,
    })
    const [cropSubtotal] = exam.cropSubtotals

    await createCropSubtotal({
      cropRegionId: cropSubtotal.cropRegionId,
      subtotalId: cropSubtotal.subtotalId,
      assignmentType: "QUESTION_ASSIGNMENT",
    })
    await deleteCropSubtotal(crypto.randomUUID())

    expect(await assignmentLogs()).toHaveLength(0)
  })
})

describe("学級の作業領域", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  it("作成・編集・削除を学級の作業領域で記録する", async () => {
    const classroom = await createClassroom({ name: "1年A組" })
    await updateClassroom({ id: classroom.id, name: "1年B組" })
    await deleteClassroom(classroom.id)

    const logs = await prisma.auditLog.findMany({
      where: { entityId: classroom.id },
      orderBy: { createdAt: "asc" },
    })
    expect(
      logs.map((log) => [log.action, log.scopeId, log.scopeLabel])
    ).toEqual([
      ["class.create", classroom.id, "1年A組"],
      ["class.update", classroom.id, "1年B組"],
      ["class.delete", classroom.id, "1年B組"],
    ])
  })
})
