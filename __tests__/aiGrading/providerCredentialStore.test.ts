/**
 * AI 採点の API キー・同意の保存のテスト。Electron の safeStorage の代わりに偽の暗号化を渡す
 */

import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// 本体は既定の口のために electron を import する。テストでは使わないので空にする
vi.mock("electron", () => ({ app: {}, safeStorage: {} }))

import type { CredentialEncryption } from "../../electron-src/lib/aiGrading/providerCredentialStore"
import {
  createProviderCredentialStore,
  ProviderCredentialError,
} from "../../electron-src/lib/aiGrading/providerCredentialStore"

const TEST_API_KEY = "sk-test-not-a-real-key-0123456789"

/** 平文が残らない、元に戻せる偽の暗号化 */
function createFakeEncryption(isAvailable = true): CredentialEncryption {
  return {
    isEncryptionAvailable: () => isAvailable,
    encryptString: (plainText) =>
      Buffer.from(Buffer.from(plainText, "utf-8").map((byte) => byte ^ 0x5a)),
    decryptString: (encrypted) =>
      Buffer.from(encrypted.map((byte) => byte ^ 0x5a)).toString("utf-8"),
  }
}

function getErrorCode(action: () => void): string | null {
  try {
    action()
  } catch (error) {
    return error instanceof ProviderCredentialError ? error.code : "other"
  }
  return null
}

describe("providerCredentialStore", () => {
  let temporaryDirectory: string
  let configFilePath: string

  function createStore(encryption = createFakeEncryption()) {
    return createProviderCredentialStore({
      configFilePath,
      encryption,
      now: () => new Date("2026-10-04T09:00:00.000Z"),
    })
  }

  function readConfigFileText(): string {
    return fs.existsSync(configFilePath)
      ? fs.readFileSync(configFilePath, "utf-8")
      : ""
  }

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "ai-providers-test-")
    )
    configFilePath = path.join(temporaryDirectory, "ai-providers.json")
  })

  afterEach(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true })
  })

  it("ファイルが無ければ既定値（同意なし・キーなし・同時実行数4）", () => {
    const store = createStore()
    expect(store.getProviderStatuses()).toEqual([
      {
        provider: "anthropic",
        hasApiKey: false,
        isEncryptionAvailable: true,
        consent: null,
      },
      {
        provider: "openai",
        hasApiKey: false,
        isEncryptionAvailable: true,
        consent: null,
      },
    ])
    expect(store.getSettings()).toMatchObject({
      defaultProvider: "anthropic",
      defaultModels: { anthropic: "claude-opus-5-5" },
      defaultEffort: "medium",
      concurrency: 4,
      budgetWarningUsd: null,
      openaiCompatibleBaseUrl: null,
    })
  })

  it("同意していない事業者のキーは保存しない", () => {
    const store = createStore()
    expect(getErrorCode(() => store.setApiKey("anthropic", TEST_API_KEY))).toBe(
      "consent_required"
    )
    expect(readConfigFileText()).not.toContain(TEST_API_KEY)
  })

  it("暗号化できない環境ではキーの保存を拒否する", () => {
    const store = createStore(createFakeEncryption(false))
    store.recordConsent("anthropic", { userId: "user-1", consentVersion: "1" })
    expect(getErrorCode(() => store.setApiKey("anthropic", TEST_API_KEY))).toBe(
      "encryption_unavailable"
    )
    expect(store.getProviderStatus("anthropic")).toMatchObject({
      hasApiKey: false,
      isEncryptionAvailable: false,
    })
    expect(readConfigFileText()).not.toContain(TEST_API_KEY)
  })

  it("状態の戻り値にもファイルにもキーの平文が現れない", () => {
    const store = createStore()
    store.recordConsent("openai", { userId: "user-1", consentVersion: "1" })
    store.setApiKey("openai", TEST_API_KEY)

    const status = store.getProviderStatus("openai")
    expect(status.hasApiKey).toBe(true)
    expect(JSON.stringify(status)).not.toContain(TEST_API_KEY)
    expect(JSON.stringify(store.getProviderStatuses())).not.toContain(
      TEST_API_KEY
    )
    expect(JSON.stringify(store.getSettings())).not.toContain(TEST_API_KEY)
    expect(readConfigFileText()).not.toContain(TEST_API_KEY)
    // main の中でだけ復号できる
    expect(store.readApiKeyForMainProcessOnly("openai")).toBe(TEST_API_KEY)
    expect(store.readApiKeyForMainProcessOnly("anthropic")).toBeNull()
  })

  it("同意を取り消すと、その事業者のキーも消える（他の事業者は残る）", () => {
    const store = createStore()
    store.recordConsent("anthropic", { userId: "user-1", consentVersion: "1" })
    store.recordConsent("openai", { userId: "user-1", consentVersion: "1" })
    store.setApiKey("anthropic", TEST_API_KEY)
    store.setApiKey("openai", `${TEST_API_KEY}-openai`)

    store.revokeConsent("anthropic")

    expect(store.getProviderStatus("anthropic")).toMatchObject({
      hasApiKey: false,
      consent: null,
    })
    expect(store.readApiKeyForMainProcessOnly("anthropic")).toBeNull()
    expect(store.readApiKeyForMainProcessOnly("openai")).toBe(
      `${TEST_API_KEY}-openai`
    )
    const savedFile = JSON.parse(readConfigFileText())
    expect(savedFile.providers.anthropic).toEqual({
      encryptedApiKey: null,
      consent: null,
    })
  })

  it("キーを消すと同意は残る", () => {
    const store = createStore()
    store.recordConsent("anthropic", { userId: "user-1", consentVersion: "1" })
    store.setApiKey("anthropic", TEST_API_KEY)
    store.clearApiKey("anthropic")
    expect(store.getProviderStatus("anthropic")).toMatchObject({
      hasApiKey: false,
      consent: { userId: "user-1" },
    })
  })

  it("ファイルの形で保存し、別の口から同じ内容を読める", () => {
    const store = createStore()
    store.recordConsent("anthropic", { userId: "user-1", consentVersion: "2" })
    store.setApiKey("anthropic", ` ${TEST_API_KEY} `)
    store.updateSettings({ concurrency: 8, budgetWarningUsd: 12.5 })

    const savedFile = JSON.parse(readConfigFileText())
    expect(savedFile).toEqual({
      version: 1,
      providers: {
        anthropic: {
          encryptedApiKey: expect.any(String),
          consent: {
            userId: "user-1",
            consentVersion: "2",
            consentedAt: "2026-10-04T09:00:00.000Z",
          },
        },
        openai: { encryptedApiKey: null, consent: null },
      },
      settings: {
        defaultProvider: "anthropic",
        defaultModels: { anthropic: "claude-opus-5-5", openai: "gpt-5.5" },
        defaultEffort: "medium",
        concurrency: 8,
        budgetWarningUsd: 12.5,
        openaiCompatibleBaseUrl: null,
      },
    })
    // 暗号文は base64
    expect(
      Buffer.from(savedFile.providers.anthropic.encryptedApiKey, "base64")
        .length
    ).toBeGreaterThan(0)

    const reopenedStore = createStore()
    expect(reopenedStore.readApiKeyForMainProcessOnly("anthropic")).toBe(
      TEST_API_KEY
    )
    expect(reopenedStore.getSettings().concurrency).toBe(8)
    expect(reopenedStore.getProviderStatus("anthropic").consent).toEqual(
      savedFile.providers.anthropic.consent
    )
  })

  it("壊れたファイル・正しくない値は既定値に戻して読む", () => {
    fs.writeFileSync(configFilePath, "{ not json", "utf-8")
    expect(createStore().getSettings().concurrency).toBe(4)

    fs.writeFileSync(
      configFilePath,
      JSON.stringify({
        providers: { anthropic: { encryptedApiKey: 42, consent: "yes" } },
        settings: {
          defaultProvider: "gemini",
          concurrency: 0,
          defaultEffort: "max",
          openaiCompatibleBaseUrl: "file:///etc/passwd",
          budgetWarningUsd: 3,
        },
      }),
      "utf-8"
    )
    const store = createStore()
    expect(store.getProviderStatus("anthropic")).toMatchObject({
      hasApiKey: false,
      consent: null,
    })
    expect(store.getSettings()).toMatchObject({
      defaultProvider: "anthropic",
      concurrency: 4,
      defaultEffort: "medium",
      openaiCompatibleBaseUrl: null,
      budgetWarningUsd: 3,
    })
  })

  it("正しくない設定の変更は全体を拒否し、何も変えない", () => {
    const store = createStore()
    expect(
      getErrorCode(() =>
        store.updateSettings({ concurrency: 2, openaiCompatibleBaseUrl: "x" })
      )
    ).toBe("invalid_settings")
    expect(getErrorCode(() => store.updateSettings({ concurrency: 1.5 }))).toBe(
      "invalid_settings"
    )
    expect(store.getSettings().concurrency).toBe(4)

    expect(
      store.updateSettings({
        openaiCompatibleBaseUrl: "http://localhost:11434/v1",
      }).openaiCompatibleBaseUrl
    ).toBe("http://localhost:11434/v1")
  })

  it("復号に失敗したら decryption_failed", () => {
    const store = createStore()
    store.recordConsent("anthropic", { userId: "user-1", consentVersion: "1" })
    store.setApiKey("anthropic", TEST_API_KEY)
    const brokenStore = createStore({
      ...createFakeEncryption(),
      decryptString: () => {
        throw new Error("keychain changed")
      },
    })
    expect(
      getErrorCode(() => brokenStore.readApiKeyForMainProcessOnly("anthropic"))
    ).toBe("decryption_failed")
  })
})
