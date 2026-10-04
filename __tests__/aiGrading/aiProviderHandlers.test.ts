/**
 * AI 採点の事業者ごとの同意・API キーの IPC（設計 §9）。
 *
 * ここで固定すること:
 *
 * - **どのチャンネルの戻り値にも API キーが現れない**（キーを返すチャンネルは作らない）。
 *   チャンネルを足したら、下の呼び方の表に足さないとこのテストが落ちる
 * - 同意は main が決めた「今ログインしている利用者」と「今の同意文の版」で記録される
 * - 取り消すとキーも消える。別の利用者が同意し直すと、前の利用者のキーは引き継がない
 * - 監査ログに同意・取り消しが残り、キーや同意文の本文は残らない
 *
 * 実物の Electron・DB・ネットワークは使わない。
 */

import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const TEST_API_KEY = "sk-test-not-a-real-key-handler-0123456789"

const mocks = vi.hoisted(() => ({
  userDataDirectory: { current: "" },
  actorUserId: { current: null as string | null },
  recordAuditLog: vi.fn(async () => undefined),
  openExternal: vi.fn(async () => undefined),
  netFetch: vi.fn(async () => {
    throw new Error("テストでネットワークへ出てはならない")
  }),
  testConnection: vi.fn(async () => undefined),
  createGradingProvider: vi.fn(),
}))

vi.mock("electron", () => ({
  app: { getPath: () => mocks.userDataDirectory.current },
  // 平文が残らない、元に戻せる偽の暗号化
  safeStorage: {
    isEncryptionAvailable: () => true,
    encryptString: (plainText: string) =>
      Buffer.from(Buffer.from(plainText, "utf-8").map((byte) => byte ^ 0x5a)),
    decryptString: (encrypted: Buffer) =>
      Buffer.from(encrypted.map((byte) => byte ^ 0x5a)).toString("utf-8"),
  },
  net: { fetch: mocks.netFetch },
  shell: { openExternal: mocks.openExternal },
}))

vi.mock("../../electron-src/lib/prisma/auditActor", () => ({
  getCurrentActorUserId: () => mocks.actorUserId.current,
}))

vi.mock("../../electron-src/lib/prisma/auditLog", () => ({
  recordAuditLog: mocks.recordAuditLog,
}))

vi.mock(
  "../../electron-src/lib/aiGrading/providers/createGradingProvider",
  () => ({ createGradingProvider: mocks.createGradingProvider })
)

import { aiProviderHandlers } from "../../electron-src/ipc-handlers/aiProviderHandlers"
import { GradingProviderError } from "../../electron-src/lib/aiGrading/providers/providerShared"
import { AI_GRADING_CONSENT_VERSION } from "../../src/lib/shared/aiGrading/consentText"

type ChannelName = keyof typeof aiProviderHandlers

const temporaryDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), "ai-provider-handlers-test-")
)
mocks.userDataDirectory.current = temporaryDirectory
const configFilePath = path.join(temporaryDirectory, "ai-providers.json")

/** 全チャンネルを1度ずつ呼ぶ。チャンネルを足したら、ここにも足す（足さないと落ちる） */
const CALL_EVERY_CHANNEL: Record<ChannelName, () => Promise<unknown>> = {
  "aiProvider:getStatuses": () =>
    aiProviderHandlers["aiProvider:getStatuses"](),
  "aiProvider:recordConsent": () =>
    aiProviderHandlers["aiProvider:recordConsent"]("anthropic"),
  "aiProvider:setApiKey": () =>
    aiProviderHandlers["aiProvider:setApiKey"]("anthropic", TEST_API_KEY),
  "aiProvider:getSettings": () =>
    aiProviderHandlers["aiProvider:getSettings"](),
  "aiProvider:updateSettings": () =>
    aiProviderHandlers["aiProvider:updateSettings"]({ concurrency: 2 }),
  "aiProvider:testConnection": () =>
    aiProviderHandlers["aiProvider:testConnection"]("anthropic"),
  "aiProvider:openTermsLink": () =>
    aiProviderHandlers["aiProvider:openTermsLink"](
      "anthropic",
      "commercial-terms"
    ),
  "aiProvider:clearApiKey": () =>
    aiProviderHandlers["aiProvider:clearApiKey"]("openai"),
  "aiProvider:revokeConsent": () =>
    aiProviderHandlers["aiProvider:revokeConsent"]("openai"),
}

describe("aiProviderHandlers", () => {
  beforeEach(() => {
    fs.rmSync(configFilePath, { force: true })
    mocks.actorUserId.current = "user-a"
    mocks.recordAuditLog.mockClear()
    mocks.openExternal.mockClear()
    mocks.netFetch.mockClear()
    mocks.testConnection.mockReset()
    mocks.testConnection.mockResolvedValue(undefined)
    mocks.createGradingProvider.mockReset()
    mocks.createGradingProvider.mockImplementation(() => ({
      testConnection: mocks.testConnection,
    }))
  })

  afterAll(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true })
  })

  it("呼び方の表が全チャンネルを覆っている", () => {
    expect(Object.keys(CALL_EVERY_CHANNEL).sort()).toEqual(
      Object.keys(aiProviderHandlers).sort()
    )
  })

  it("キーを保存したあとでも、どのチャンネルの戻り値にもキーが現れない", async () => {
    // 接続テストの失敗文にキーが混ざっても、伏せて返す
    mocks.testConnection.mockRejectedValue(
      new GradingProviderError(
        "authentication",
        `invalid x-api-key: ${TEST_API_KEY}`
      )
    )
    const outputs: unknown[] = []
    for (const callChannel of Object.values(CALL_EVERY_CHANNEL)) {
      outputs.push(await callChannel())
    }
    // 呼んだ後にもう一度、状態と既定値を読む（保存済みのキーがある状態で）
    outputs.push(await aiProviderHandlers["aiProvider:getStatuses"]())
    outputs.push(await aiProviderHandlers["aiProvider:getSettings"]())

    outputs.forEach((output) => {
      expect(JSON.stringify(output) ?? "").not.toContain(TEST_API_KEY)
    })
    // キーは確かに保存されていた（保存されずに素通りしたのではない）
    const statuses = await aiProviderHandlers["aiProvider:getStatuses"]()
    expect(
      statuses.find((status) => status.provider === "anthropic")?.hasApiKey
    ).toBe(true)
    // 監査ログにもキーは残らない
    expect(JSON.stringify(mocks.recordAuditLog.mock.calls)).not.toContain(
      TEST_API_KEY
    )
  })

  it("同意は今ログインしている利用者と今の同意文の版で記録され、監査ログに残る", async () => {
    mocks.actorUserId.current = "user-current"
    const consent =
      await aiProviderHandlers["aiProvider:recordConsent"]("anthropic")

    expect(consent.userId).toBe("user-current")
    expect(consent.consentVersion).toBe(AI_GRADING_CONSENT_VERSION)

    const statuses = await aiProviderHandlers["aiProvider:getStatuses"]()
    const anthropicStatus = statuses.find(
      (status) => status.provider === "anthropic"
    )
    expect(anthropicStatus?.consent).toEqual(consent)
    // OpenAI には同意していない（事業者ごと）
    expect(
      statuses.find((status) => status.provider === "openai")?.consent
    ).toBeNull()

    expect(mocks.recordAuditLog).toHaveBeenCalledTimes(1)
    expect(mocks.recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "ai_grading.consent",
        userId: "user-current",
        entityId: "anthropic",
        extra: { consentVersion: AI_GRADING_CONSENT_VERSION },
      })
    )
  })

  it("ログインしている利用者が分からなければ同意を記録しない", async () => {
    mocks.actorUserId.current = null
    await expect(
      aiProviderHandlers["aiProvider:recordConsent"]("anthropic")
    ).rejects.toThrow()
    const statuses = await aiProviderHandlers["aiProvider:getStatuses"]()
    expect(statuses.every((status) => status.consent === null)).toBe(true)
    expect(mocks.recordAuditLog).not.toHaveBeenCalled()
  })

  it("取り消すとキーも消え、監査ログに残る", async () => {
    await aiProviderHandlers["aiProvider:recordConsent"]("anthropic")
    await aiProviderHandlers["aiProvider:setApiKey"]("anthropic", TEST_API_KEY)

    await aiProviderHandlers["aiProvider:revokeConsent"]("anthropic")

    const statuses = await aiProviderHandlers["aiProvider:getStatuses"]()
    const anthropicStatus = statuses.find(
      (status) => status.provider === "anthropic"
    )
    expect(anthropicStatus?.consent).toBeNull()
    expect(anthropicStatus?.hasApiKey).toBe(false)
    // ファイルからも消えている（暗号化された形でも残らない）
    expect(fs.readFileSync(configFilePath, "utf-8")).not.toContain(
      'encryptedApiKey": "'
    )
    expect(mocks.recordAuditLog).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: "ai_grading.consent_revoked",
        entityId: "anthropic",
      })
    )
  })

  it("別の利用者が同意し直すと、前の利用者のキーを引き継がない", async () => {
    await aiProviderHandlers["aiProvider:recordConsent"]("anthropic")
    await aiProviderHandlers["aiProvider:setApiKey"]("anthropic", TEST_API_KEY)

    mocks.actorUserId.current = "user-b"
    await aiProviderHandlers["aiProvider:recordConsent"]("anthropic")

    const statuses = await aiProviderHandlers["aiProvider:getStatuses"]()
    const anthropicStatus = statuses.find(
      (status) => status.provider === "anthropic"
    )
    expect(anthropicStatus?.consent?.userId).toBe("user-b")
    expect(anthropicStatus?.hasApiKey).toBe(false)
  })

  it("同じ利用者が同意し直す（版が上がった）ときは、キーを残す", async () => {
    await aiProviderHandlers["aiProvider:recordConsent"]("anthropic")
    await aiProviderHandlers["aiProvider:setApiKey"]("anthropic", TEST_API_KEY)

    await aiProviderHandlers["aiProvider:recordConsent"]("anthropic")

    const statuses = await aiProviderHandlers["aiProvider:getStatuses"]()
    expect(
      statuses.find((status) => status.provider === "anthropic")?.hasApiKey
    ).toBe(true)
  })

  it("接続テストは保存したキーと Electron の fetch で事業者を作り、結果を種類で返す", async () => {
    await aiProviderHandlers["aiProvider:recordConsent"]("anthropic")
    await aiProviderHandlers["aiProvider:setApiKey"]("anthropic", TEST_API_KEY)

    const okResult =
      await aiProviderHandlers["aiProvider:testConnection"]("anthropic")
    expect(okResult).toEqual({ outcome: "ok", message: "" })
    expect(mocks.createGradingProvider).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "anthropic", apiKey: TEST_API_KEY })
    )

    const cases = [
      ["permission", "authentication"],
      ["timeout", "connection"],
      ["connection", "connection"],
      ["rate_limit", "rate_limit"],
      ["server", "unknown"],
    ] as const
    for (const [errorKind, expectedOutcome] of cases) {
      mocks.testConnection.mockRejectedValueOnce(
        new GradingProviderError(errorKind, "失敗しました")
      )
      const result =
        await aiProviderHandlers["aiProvider:testConnection"]("anthropic")
      expect(result.outcome).toBe(expectedOutcome)
    }
  })

  it("キーが無いときの接続テストは、事業者を作らずに認証の失敗として返す", async () => {
    const result =
      await aiProviderHandlers["aiProvider:testConnection"]("openai")
    expect(result.outcome).toBe("authentication")
    expect(mocks.createGradingProvider).not.toHaveBeenCalled()
    expect(mocks.netFetch).not.toHaveBeenCalled()
  })

  it("規約のリンクは名前で引いた URL だけを開き、知らない名前は開かない", async () => {
    await aiProviderHandlers["aiProvider:openTermsLink"]("anthropic", "privacy")
    expect(mocks.openExternal).toHaveBeenCalledWith(
      "https://www.anthropic.com/legal/privacy"
    )

    await expect(
      aiProviderHandlers["aiProvider:openTermsLink"](
        "anthropic",
        "https://example.com/evil"
      )
    ).rejects.toThrow()
    expect(mocks.openExternal).toHaveBeenCalledTimes(1)
  })

  it("対応していない事業者 id は弾く", async () => {
    await expect(
      // IPC を渡ってくる値は型どおりとは限らない
      // @ts-expect-error 型の外の値を渡す
      aiProviderHandlers["aiProvider:recordConsent"]("gemini")
    ).rejects.toThrow()
  })
})
