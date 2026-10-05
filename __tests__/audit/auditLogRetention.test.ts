/**
 * 操作履歴を残す日数の読み書き。
 *
 * 全員で1つの設定（`AppPreference`）に持ち、変えたこと自体を `system` の操作履歴に残す。
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

import {
  getAuditLogRetentionDays,
  setAuditLogRetentionDays,
} from "@/electron-src/lib/prisma/appPreference"
import {
  AUDIT_LOG_RETENTION_DAYS_KEY,
  DEFAULT_AUDIT_LOG_RETENTION_DAYS,
  formatAuditLogRetentionDays,
  parseAuditLogRetentionDays,
} from "@/lib/shared/auditLogRetention"

import {
  cleanupTestDatabase,
  disconnectTestPrisma,
  getTestPrismaClient,
} from "../helpers/testPrismaClient"

const prisma = getTestPrismaClient()

describe("parseAuditLogRetentionDays", () => {
  it("設定が無ければ既定の365日", () => {
    expect(DEFAULT_AUDIT_LOG_RETENTION_DAYS).toBe(365)
    expect(parseAuditLogRetentionDays(null)).toBe(365)
  })

  it("正の整数を読む（選択肢に無い日数も受け付ける）", () => {
    expect(parseAuditLogRetentionDays("180")).toBe(180)
    expect(parseAuditLogRetentionDays("400")).toBe(400)
  })

  it("壊れた値は既定として扱う", () => {
    expect(parseAuditLogRetentionDays("abc")).toBe(365)
    expect(parseAuditLogRetentionDays("0")).toBe(365)
    expect(parseAuditLogRetentionDays("-30")).toBe(365)
    expect(parseAuditLogRetentionDays("1.5")).toBe(365)
    expect(parseAuditLogRetentionDays('"365"')).toBe(365)
  })

  it("年で割り切れる日数は年で見せる", () => {
    expect(formatAuditLogRetentionDays(365)).toBe("1年")
    expect(formatAuditLogRetentionDays(730)).toBe("2年")
    expect(formatAuditLogRetentionDays(90)).toBe("90日")
  })
})

describe("setAuditLogRetentionDays", () => {
  beforeEach(async () => {
    await cleanupTestDatabase()
    await prisma.appPreference.deleteMany({
      where: { key: AUDIT_LOG_RETENTION_DAYS_KEY },
    })
  })

  afterAll(async () => {
    await prisma.appPreference.deleteMany({
      where: { key: AUDIT_LOG_RETENTION_DAYS_KEY },
    })
    await disconnectTestPrisma()
  })

  it("保存した日数を起動時の整理が読む", async () => {
    expect(await getAuditLogRetentionDays()).toBe(365)
    await setAuditLogRetentionDays(180)
    expect(await getAuditLogRetentionDays()).toBe(180)
  })

  it("変えたことを system の操作履歴に、変更前後の期間つきで残す", async () => {
    await setAuditLogRetentionDays(180)

    const logs = await prisma.auditLog.findMany({
      where: { action: "system.audit_log_retention.update" },
    })
    expect(logs).toHaveLength(1)
    expect(logs[0].category).toBe("system")
    expect(logs[0].entityId).toBe(AUDIT_LOG_RETENTION_DAYS_KEY)
    expect(JSON.parse(logs[0].metadata ?? "{}")).toEqual({
      changes: [
        {
          field: "retentionDays",
          label: "残す期間",
          before: "1年",
          after: "180日",
        },
      ],
    })
  })

  it("同じ日数を選び直しても記録しない", async () => {
    await setAuditLogRetentionDays(365)
    expect(
      await prisma.auditLog.count({
        where: { action: "system.audit_log_retention.update" },
      })
    ).toBe(0)
  })

  it("正の整数でなければ保存しない", async () => {
    await expect(setAuditLogRetentionDays(0)).rejects.toThrow()
    await expect(setAuditLogRetentionDays(1.5)).rejects.toThrow()
    expect(await getAuditLogRetentionDays()).toBe(365)
  })
})
