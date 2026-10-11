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

async function getErrorCode(action: () => unknown): Promise<string | null> {
  try {
    await action()
  } catch (error) {
    return error instanceof ProviderCredentialError ? error.code : "other"
  }
  return null
}

describe("providerCredentialStore", () => {
  let temporaryDirectory: string
  let configFilePath: string

  async function createStore(encryption = createFakeEncryption()) {
    const store = createProviderCredentialStore({
      configFilePath,
      encryption,
      now: () => new Date("2026-10-04T09:00:00.000Z"),
    })
    await store.load()
    return store
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

  it("ファイルが無ければ既定値（同意なし・キーなし・同時実行数4）", async () => {
    const store = await createStore()
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
      defaultMode: "realtime",
      concurrency: 4,
      budgetWarningUsd: null,
      openaiCompatibleBaseUrl: null,
    })
    expect(store.getModelCatalogs()).toEqual({ anthropic: null, openai: null })
    // 単価はアプリが持たない（入れるまで空）
    expect(store.getPricing()).toEqual({
      modelPrices: [],
      batchPricePercents: { anthropic: null, openai: null },
    })
  })

  it("同意していない事業者のキーは保存しない", async () => {
    const store = await createStore()
    expect(
      await getErrorCode(() => store.setApiKey("anthropic", TEST_API_KEY))
    ).toBe("consent_required")
    expect(readConfigFileText()).not.toContain(TEST_API_KEY)
  })

  it("暗号化できない環境ではキーの保存を拒否する", async () => {
    const store = await createStore(createFakeEncryption(false))
    await store.recordConsent("anthropic", {
      userId: "user-1",
      consentVersion: "1",
    })
    expect(
      await getErrorCode(() => store.setApiKey("anthropic", TEST_API_KEY))
    ).toBe("encryption_unavailable")
    expect(store.getProviderStatus("anthropic")).toMatchObject({
      hasApiKey: false,
      isEncryptionAvailable: false,
    })
    expect(readConfigFileText()).not.toContain(TEST_API_KEY)
  })

  it("状態の戻り値にもファイルにもキーの平文が現れない", async () => {
    const store = await createStore()
    await store.recordConsent("openai", {
      userId: "user-1",
      consentVersion: "1",
    })
    await store.setApiKey("openai", TEST_API_KEY)

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

  it("同意を取り消すと、その事業者のキーも消える（他の事業者は残る）", async () => {
    const store = await createStore()
    await store.recordConsent("anthropic", {
      userId: "user-1",
      consentVersion: "1",
    })
    await store.recordConsent("openai", {
      userId: "user-1",
      consentVersion: "1",
    })
    await store.setApiKey("anthropic", TEST_API_KEY)
    await store.setApiKey("openai", `${TEST_API_KEY}-openai`)

    await store.revokeConsent("anthropic")

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

  it("キーを消すと同意は残る", async () => {
    const store = await createStore()
    await store.recordConsent("anthropic", {
      userId: "user-1",
      consentVersion: "1",
    })
    await store.setApiKey("anthropic", TEST_API_KEY)
    await store.clearApiKey("anthropic")
    expect(store.getProviderStatus("anthropic")).toMatchObject({
      hasApiKey: false,
      consent: { userId: "user-1" },
    })
  })

  it("ファイルの形で保存し、別の口から同じ内容を読める", async () => {
    const store = await createStore()
    await store.recordConsent("anthropic", {
      userId: "user-1",
      consentVersion: "2",
    })
    await store.setApiKey("anthropic", ` ${TEST_API_KEY} `)
    await store.updateSettings({ concurrency: 8, budgetWarningUsd: 12.5 })

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
        defaultMode: "realtime",
        concurrency: 8,
        budgetWarningUsd: 12.5,
        openaiCompatibleBaseUrl: null,
        anthropicPricingSourceUrl:
          "https://platform.claude.com/docs/ja/about-claude/pricing",
        openaiPricingSourceUrl:
          "https://developers.openai.com/api/docs/pricing",
        defaultAnnotationInstruction: "",
      },
      modelCatalogs: { anthropic: null, openai: null },
      pricing: {
        modelPrices: [],
        batchPricePercents: { anthropic: null, openai: null },
      },
    })
    // 暗号文は base64
    expect(
      Buffer.from(savedFile.providers.anthropic.encryptedApiKey, "base64")
        .length
    ).toBeGreaterThan(0)

    const reopenedStore = await createStore()
    expect(reopenedStore.readApiKeyForMainProcessOnly("anthropic")).toBe(
      TEST_API_KEY
    )
    expect(reopenedStore.getSettings().concurrency).toBe(8)
    expect(reopenedStore.getProviderStatus("anthropic").consent).toEqual(
      savedFile.providers.anthropic.consent
    )
  })

  it("壊れたファイル・正しくない値は既定値に戻して読む", async () => {
    fs.writeFileSync(configFilePath, "{ not json", "utf-8")
    expect((await createStore()).getSettings().concurrency).toBe(4)

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
    const store = await createStore()
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

  it("正しくない設定の変更は全体を拒否し、何も変えない", async () => {
    const store = await createStore()
    expect(
      await getErrorCode(() =>
        store.updateSettings({ concurrency: 2, openaiCompatibleBaseUrl: "x" })
      )
    ).toBe("invalid_settings")
    expect(
      await getErrorCode(() => store.updateSettings({ concurrency: 1.5 }))
    ).toBe("invalid_settings")
    expect(store.getSettings().concurrency).toBe(4)

    expect(
      (
        await store.updateSettings({
          openaiCompatibleBaseUrl: "http://localhost:11434/v1",
        })
      ).openaiCompatibleBaseUrl
    ).toBe("http://localhost:11434/v1")
  })

  it("復号に失敗したら decryption_failed", async () => {
    const store = await createStore()
    await store.recordConsent("anthropic", {
      userId: "user-1",
      consentVersion: "1",
    })
    await store.setApiKey("anthropic", TEST_API_KEY)
    const brokenStore = await createStore({
      ...createFakeEncryption(),
      decryptString: () => {
        throw new Error("keychain changed")
      },
    })
    expect(
      await getErrorCode(() =>
        brokenStore.readApiKeyForMainProcessOnly("anthropic")
      )
    ).toBe("decryption_failed")
  })

  it("送り方の既定値は、選択肢の値だけを保存する", async () => {
    const store = await createStore()
    expect(await store.updateSettings({ defaultMode: "batch" })).toMatchObject({
      defaultMode: "batch",
    })
    expect((await createStore()).getSettings()).toMatchObject({
      defaultMode: "batch",
    })
    expect(
      await getErrorCode(() =>
        // IPC を渡ってくる値は型どおりとは限らない
        // @ts-expect-error 型の外の値を渡す
        store.updateSettings({ defaultMode: "later" })
      )
    ).toBe("invalid_settings")

    // ファイルに書かれた正しくない値は既定値に戻す
    fs.writeFileSync(
      configFilePath,
      JSON.stringify({
        settings: { defaultMode: "x" },
      }),
      "utf-8"
    )
    expect((await createStore()).getSettings()).toMatchObject({
      defaultMode: "realtime",
    })
  })

  it("モデルの一覧を事業者ごとに保存し、別の口からも読め、キーは含まない", async () => {
    const store = await createStore()
    await store.recordConsent("anthropic", {
      userId: "user-1",
      consentVersion: "1",
    })
    await store.setApiKey("anthropic", TEST_API_KEY)
    const catalog = await store.saveModelCatalog("anthropic", [
      {
        id: "claude-opus-5-5",
        displayName: "Claude Opus 5.5",
        createdAt: "2026-09-01T00:00:00.000Z",
        supportsAdaptiveThinking: true,
      },
      {
        id: "claude-legacy",
        displayName: "claude-legacy",
        createdAt: null,
        supportsAdaptiveThinking: null,
      },
    ])
    expect(catalog.fetchedAt).toBe("2026-10-04T09:00:00.000Z")
    expect(catalog.models).toHaveLength(2)
    expect((await createStore()).getModelCatalogs()).toEqual({
      anthropic: catalog,
      openai: null,
    })
    expect(
      JSON.stringify((await createStore()).getModelCatalogs())
    ).not.toContain(TEST_API_KEY)
    // 設定を変えても一覧は残る
    await store.updateSettings({ concurrency: 3 })
    expect((await createStore()).getModelCatalogs().anthropic).toEqual(catalog)
  })

  it("形の崩れたモデルの一覧は、一覧ごと null に戻して読む", async () => {
    fs.writeFileSync(
      configFilePath,
      JSON.stringify({
        modelCatalogs: {
          anthropic: {
            fetchedAt: "2026-10-04T09:00:00.000Z",
            models: [
              {
                id: "claude-opus-5-5",
                displayName: "Opus",
                createdAt: null,
                supportsAdaptiveThinking: "yes",
              },
            ],
          },
          openai: { fetchedAt: 42, models: [] },
        },
      }),
      "utf-8"
    )
    expect((await createStore()).getModelCatalogs()).toEqual({
      anthropic: null,
      openai: null,
    })
  })
  describe("単価（利用者が入れた値）", () => {
    // 値は作り物
    const samplePrice = {
      provider: "anthropic" as const,
      model: "test-model-a",
      inputPerMillionUsd: 3,
      outputPerMillionUsd: 9,
      cacheReadPerMillionUsd: 0.3,
      cacheWrite5mPerMillionUsd: 3.75,
      cacheWrite1hPerMillionUsd: 6,
    }

    it("入れた単価を保存し、同じ事業者・モデルは置き換える", async () => {
      const store = await createStore()
      await store.setModelPrices([samplePrice])
      await store.setModelPrices([
        { ...samplePrice, inputPerMillionUsd: 4 },
        { ...samplePrice, provider: "openai", model: "test-model-b" },
      ])
      expect((await createStore()).getPricing().modelPrices).toEqual([
        { ...samplePrice, inputPerMillionUsd: 4 },
        { ...samplePrice, provider: "openai", model: "test-model-b" },
      ])

      await store.removeModelPrice("anthropic", "test-model-a")
      expect(
        (await createStore())
          .getPricing()
          .modelPrices.map((modelPrice) => modelPrice.model)
      ).toEqual(["test-model-b"])
    })

    it("1行でも正しくない単価があれば全体を拒否し、何も変えない", async () => {
      const store = await createStore()
      await store.setModelPrices([samplePrice])
      expect(
        await getErrorCode(() =>
          store.setModelPrices([
            { ...samplePrice, model: "test-model-c" },
            { ...samplePrice, outputPerMillionUsd: -1 },
          ])
        )
      ).toBe("invalid_settings")
      expect(
        await getErrorCode(() =>
          store.setModelPrices([{ ...samplePrice, model: "  " }])
        )
      ).toBe("invalid_settings")
      expect(
        await getErrorCode(() =>
          store.setModelPrices([
            { ...samplePrice, cacheReadPerMillionUsd: Number.NaN },
          ])
        )
      ).toBe("invalid_settings")
      expect(store.getPricing().modelPrices).toEqual([samplePrice])
    })

    it("バッチの割合は 0〜100（null で未設定に戻す）", async () => {
      const store = await createStore()
      await store.setBatchPricePercent("anthropic", 50)
      expect(store.getPricing().batchPricePercents).toEqual({
        anthropic: 50,
        openai: null,
      })
      expect(
        await getErrorCode(() => store.setBatchPricePercent("openai", 101))
      ).toBe("invalid_settings")
      expect(
        await getErrorCode(() => store.setBatchPricePercent("openai", -1))
      ).toBe("invalid_settings")
      await store.setBatchPricePercent("anthropic", null)
      expect(store.getPricing().batchPricePercents.anthropic).toBeNull()
    })

    it("ファイルの崩れた単価の行だけを捨てて読む", async () => {
      fs.writeFileSync(
        configFilePath,
        JSON.stringify({
          pricing: {
            modelPrices: [
              samplePrice,
              { ...samplePrice, model: "broken", inputPerMillionUsd: "x" },
              { ...samplePrice, provider: "gemini", model: "other" },
              "not-a-row",
            ],
            batchPricePercents: { anthropic: 150, openai: 30 },
          },
        }),
        "utf-8"
      )
      expect((await createStore()).getPricing()).toEqual({
        modelPrices: [samplePrice],
        batchPricePercents: { anthropic: null, openai: 30 },
      })
    })
  })

  describe("設定の値（料金のページ・助言の文案の指示）", () => {
    it("料金のページの読み込み元は https だけ", async () => {
      const store = await createStore()
      expect(
        await getErrorCode(() =>
          store.updateSettings({
            anthropicPricingSourceUrl: "http://example.test/pricing",
          })
        )
      ).toBe("invalid_settings")
      await store.updateSettings({
        anthropicPricingSourceUrl: "https://example.test/pricing",
      })
      expect(store.getSettings().anthropicPricingSourceUrl).toBe(
        "https://example.test/pricing"
      )
      expect(
        await getErrorCode(() =>
          store.updateSettings({
            openaiPricingSourceUrl: "http://example.test/openai-pricing",
          })
        )
      ).toBe("invalid_settings")
      await store.updateSettings({
        openaiPricingSourceUrl: "https://example.test/openai-pricing",
      })
      expect(store.getSettings()).toMatchObject({
        anthropicPricingSourceUrl: "https://example.test/pricing",
        openaiPricingSourceUrl: "https://example.test/openai-pricing",
      })
    })

    it("助言の文案の指示の既定の文言は、未設定なら空で、入れた文言（複数行も）をそのまま残す", async () => {
      const store = await createStore()
      // アプリは文言を決め打ちしない
      expect(store.getSettings().defaultAnnotationInstruction).toBe("")

      const instruction = "部分点の答案にだけ書く。\n「です・ます」で、20字以内"
      await store.updateSettings({ defaultAnnotationInstruction: instruction })
      expect(
        (await createStore()).getSettings().defaultAnnotationInstruction
      ).toBe(instruction)
      // 他の項目を変えても消えない
      await store.updateSettings({ concurrency: 2 })
      expect(
        (await createStore()).getSettings().defaultAnnotationInstruction
      ).toBe(instruction)
      // 空に戻せる
      await store.updateSettings({ defaultAnnotationInstruction: "" })
      expect(
        (await createStore()).getSettings().defaultAnnotationInstruction
      ).toBe("")
    })

    it("助言の文案の指示の既定の文言が文字列でなければ、変更を拒否し、読むときは空として扱う", async () => {
      const store = await createStore()
      expect(
        await getErrorCode(() =>
          store.updateSettings({
            // IPC を渡ってくる値は型どおりとは限らない
            // @ts-expect-error 型の外の値を渡す
            defaultAnnotationInstruction: 42,
          })
        )
      ).toBe("invalid_settings")

      fs.writeFileSync(
        configFilePath,
        JSON.stringify({ settings: { defaultAnnotationInstruction: ["x"] } }),
        "utf-8"
      )
      expect(
        (await createStore()).getSettings().defaultAnnotationInstruction
      ).toBe("")
    })
  })
})
