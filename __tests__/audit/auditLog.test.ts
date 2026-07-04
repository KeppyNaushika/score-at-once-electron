/**
 * 監査ログ 統合テスト
 *
 * recordAuditLog（操作者補完・ベストエフォート）、集約（同一キーの上書き）、
 * getAuditLogs（フィルタ/ページネーション/操作者付与）、pruneAuditLogs を検証する。
 * Electron依存を回避するため prisma/client をテスト用クライアントでモックする。
 */

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

// 操作者の自動補完（認証ストア）は常に null を返すようにして、テストを決定的にする
vi.mock("../../electron-src/lib/prisma/auditActor", () => ({
  getCurrentActorUserId: () => null,
}))

import { diffFields, recordAuditLog } from "@/electron-src/lib/prisma/auditLog"
import {
  getAuditLogs,
  pruneAuditLogs,
} from "@/electron-src/lib/prisma/auditQuery"

import {
  cleanupTestDatabase,
  createPrismaClientForPath,
  createTestUser,
  disconnectTestPrisma,
} from "../helpers/testPrismaClient"

const testPrisma = createPrismaClientForPath(TEST_DB_PATH)

describe("監査ログ recordAuditLog", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  afterAll(async () => {
    await disconnectTestPrisma()
    await testPrisma.$disconnect()
  })

  it("1件記録し、getAuditLogsで取得できる（カテゴリ・verbが付与される）", async () => {
    await recordAuditLog({
      action: "exam.create",
      userId: null,
      entityType: "Exam",
      entityId: "exam-1",
      scopeId: "exam-1",
      scopeLabel: "数学 期末",
      target: "数学 期末",
    })

    const page = await getAuditLogs()
    expect(page.total).toBe(1)
    const entry = page.entries[0]
    expect(entry.action).toBe("exam.create")
    expect(entry.category).toBe("exam")
    expect(entry.verb).toBe("create")
    expect(entry.scopeLabel).toBe("数学 期末")
    expect(entry.occurrences).toBe(1)
    expect(entry.summary).toContain("数学 期末")
  })

  it("操作者名が userId から解決されて付与される", async () => {
    const user = await createTestUser({ name: "山田 太郎" })
    await recordAuditLog({
      action: "exam.update",
      userId: user.id,
      entityType: "Exam",
      entityId: "exam-1",
    })

    const page = await getAuditLogs()
    expect(page.entries[0].actorName).toBe("山田 太郎")
  })

  it("未知のアクションでも例外を投げず、category は system にフォールバックする", async () => {
    await expect(
      recordAuditLog({
        action: "totally.unknown.action",
        userId: null,
        entityType: "X",
        entityId: "x-1",
      })
    ).resolves.toBeUndefined()

    const page = await getAuditLogs()
    expect(page.total).toBe(1)
    expect(page.entries[0].category).toBe("system")
  })

  it("changes は metadata に格納される", async () => {
    await recordAuditLog({
      action: "exam.update",
      userId: null,
      entityType: "Exam",
      entityId: "exam-1",
      changes: [
        { field: "examName", label: "試験名", before: "旧", after: "新" },
      ],
    })
    const page = await getAuditLogs()
    const changes = page.entries[0].metadata?.changes as
      { before: unknown; after: unknown }[] | undefined
    expect(changes?.[0].before).toBe("旧")
    expect(changes?.[0].after).toBe("新")
  })
})

describe("監査ログ 集約（coalesce）", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  it("同一キー・同一操作者の連続操作は1行に集約され、occurrences が増え after が上書きされる", async () => {
    const key = "annotation.update:mark-1"
    await recordAuditLog({
      action: "exam.annotation.update",
      userId: "u-1",
      entityType: "DrawingAnnotation",
      entityId: "mark-1",
      coalesceKey: key,
      changes: [{ field: "text", label: "テキスト", before: null, after: "A" }],
    })
    await recordAuditLog({
      action: "exam.annotation.update",
      userId: "u-1",
      entityType: "DrawingAnnotation",
      entityId: "mark-1",
      coalesceKey: key,
      changes: [{ field: "text", label: "テキスト", before: null, after: "B" }],
    })

    const page = await getAuditLogs()
    expect(page.total).toBe(1)
    expect(page.entries[0].occurrences).toBe(2)
    const changes = page.entries[0].metadata?.changes as
      { after: unknown }[] | undefined
    expect(changes?.[0].after).toBe("B") // after は最新で上書き
  })

  it("操作者が異なれば別行になる", async () => {
    const key = "annotation.update:mark-1"
    await recordAuditLog({
      action: "exam.annotation.update",
      userId: "u-1",
      entityType: "DrawingAnnotation",
      entityId: "mark-1",
      coalesceKey: key,
    })
    await recordAuditLog({
      action: "exam.annotation.update",
      userId: "u-2",
      entityType: "DrawingAnnotation",
      entityId: "mark-1",
      coalesceKey: key,
    })
    const page = await getAuditLogs()
    expect(page.total).toBe(2)
  })

  it("coalesceKey が無ければ毎回新規行になる", async () => {
    for (let i = 0; i < 3; i++) {
      await recordAuditLog({
        action: "exam.annotation.create",
        userId: "u-1",
        entityType: "DrawingAnnotation",
        entityId: `mark-${i}`,
      })
    }
    const page = await getAuditLogs()
    expect(page.total).toBe(3)
  })

  it("時間窓を過ぎた同一キーは集約せず新規行になる", async () => {
    const key = "marking_format:exam-1"
    await recordAuditLog({
      action: "exam.marking_format.update",
      userId: "u-1",
      entityType: "ExamMarkingFormat",
      entityId: "exam-1",
      coalesceKey: key,
    })
    // 既存行の updatedAt を6分前に後退させる（窓=5分）
    const past = new Date(Date.now() - 6 * 60 * 1000).toISOString()
    await testPrisma.$executeRawUnsafe(
      `UPDATE "AuditLog" SET "updatedAt" = ? WHERE "coalesceKey" = ?`,
      past,
      key
    )
    await recordAuditLog({
      action: "exam.marking_format.update",
      userId: "u-1",
      entityType: "ExamMarkingFormat",
      entityId: "exam-1",
      coalesceKey: key,
    })
    const page = await getAuditLogs()
    expect(page.total).toBe(2)
  })
})

describe("監査ログ getAuditLogs フィルタ/ページネーション", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
    await recordAuditLog({
      action: "exam.create",
      userId: "u-1",
      entityType: "Exam",
      entityId: "e1",
      summary: "試験Aを作成しました",
    })
    await recordAuditLog({
      action: "grade.create",
      userId: "u-2",
      entityType: "Grade",
      entityId: "g1",
      summary: "成績Bを作成しました",
    })
    await recordAuditLog({
      action: "student.create",
      userId: "u-1",
      entityType: "Student",
      entityId: "s1",
      summary: "生徒Cを登録しました",
    })
  })

  it("カテゴリで絞り込める", async () => {
    const page = await getAuditLogs({ category: "grade" })
    expect(page.total).toBe(1)
    expect(page.entries[0].action).toBe("grade.create")
  })

  it("操作者で絞り込める", async () => {
    const page = await getAuditLogs({ userId: "u-1" })
    expect(page.total).toBe(2)
  })

  it("サマリ部分一致で検索できる", async () => {
    const page = await getAuditLogs({ search: "成績B" })
    expect(page.total).toBe(1)
  })

  it("limit/offset でページングでき、total は全件数を返す", async () => {
    const page1 = await getAuditLogs({ limit: 2, offset: 0 })
    expect(page1.total).toBe(3)
    expect(page1.entries).toHaveLength(2)
    const page2 = await getAuditLogs({ limit: 2, offset: 2 })
    expect(page2.entries).toHaveLength(1)
  })
})

describe("監査ログ pruneAuditLogs", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  it("保持期間より古い行を削除する", async () => {
    await recordAuditLog({
      action: "exam.create",
      userId: null,
      entityType: "Exam",
      entityId: "old",
    })
    await recordAuditLog({
      action: "exam.create",
      userId: null,
      entityType: "Exam",
      entityId: "new",
    })
    // 1件を400日前に後退
    const old = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString()
    await testPrisma.$executeRawUnsafe(
      `UPDATE "AuditLog" SET "updatedAt" = ? WHERE "entityId" = 'old'`,
      old
    )

    const deleted = await pruneAuditLogs(365)
    expect(deleted).toBe(1)
    const page = await getAuditLogs()
    expect(page.total).toBe(1)
    expect(page.entries[0].entityId).toBe("new")
  })

  it("retentionDays が不正なら何もしない", async () => {
    await recordAuditLog({
      action: "exam.create",
      userId: null,
      entityType: "Exam",
      entityId: "e1",
    })
    expect(await pruneAuditLogs(0)).toBe(0)
    expect(await pruneAuditLogs(-5)).toBe(0)
    const page = await getAuditLogs()
    expect(page.total).toBe(1)
  })
})

describe("diffFields", () => {
  it("変化したフィールドのみ返す", () => {
    const changes = diffFields(
      { a: 1, b: "x", c: true },
      { a: 2, b: "x", c: false },
      [
        { field: "a", label: "A" },
        { field: "b", label: "B" },
        { field: "c", label: "C" },
      ]
    )
    expect(changes.map((change) => change.field).sort()).toEqual(["a", "c"])
  })

  it("変化が無ければ空配列", () => {
    const changes = diffFields({ a: 1 }, { a: 1 }, [{ field: "a" }])
    expect(changes).toHaveLength(0)
  })
})
