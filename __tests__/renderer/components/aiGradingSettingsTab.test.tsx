// @vitest-environment jsdom
/**
 * 「AI採点」の画面の「設定」タブ（docs/vlm-grading-design.md §9）。
 *
 * ここで固定すること:
 * - 同意するまでキーの入力欄を出さない（入口と説明だけ）
 * - 同意は8項目を1つずつ確かめないと押せない（読み飛ばせない）
 * - 同意すると、その事業者のキーの入力欄が現れる
 * - 保存したキーは画面のどこにも出ない（「設定済み」と「削除」だけ）
 * - 同意文の版が変わった同意は、今の同意として扱わない
 * - 「無効にする」の確認で、キーを消すこと・同意からやり直すこと・送信済みのデータは取り消せないこと（8項目目）を示す
 * - 既定値（送信先・モデル・Effort・処理・助言の文案の指示の文言）は「既定値」タブ、同時実行数と警告額は「設定」タブ
 *
 * window.electronAPI は偽物で、ネットワークにも実際のキーにも触れない。
 */

import "../setup"

import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AiGradingDefaultsTab } from "@/app/(app)/ai-grading/components/AiGradingDefaultsTab"
import { AiGradingSettingsTab } from "@/app/(app)/ai-grading/components/AiGradingSettingsTab"
import { AiGradingTabs } from "@/app/(app)/ai-grading/components/AiGradingTabs"
import type {
  AiGradingSettings,
  AiModelPrice,
  AiPricing,
  ProviderConsent,
  ProviderModelCatalogs,
  ProviderStatus,
} from "@/electron-src/lib/aiGrading/providerCredentialStore"
import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"
import {
  AI_GRADING_CONSENT_ITEMS,
  AI_GRADING_CONSENT_VERSION,
  AI_GRADING_REVOCATION_ITEM,
} from "@/lib/shared/aiGrading/consentText"

import { createQueryWrapper } from "../../helpers/queryWrapper"

const CURRENT_USER_ID = "user-1"
const TEST_API_KEY = "sk-test-not-a-real-key-renderer-0123456789"

// 関門（AuthGate）の内側なので、利用者は必ず居る
vi.mock("@/contexts/CurrentUserContext", () => ({
  useCurrentUser: () => ({ id: CURRENT_USER_ID, name: "田中先生" }),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const DEFAULT_SETTINGS: AiGradingSettings = {
  defaultProvider: "anthropic",
  defaultModels: { anthropic: "claude-opus-5-5", openai: "gpt-5.5" },
  defaultEffort: "medium",
  defaultMode: "realtime",
  concurrency: 4,
  budgetWarningUsd: null,
  openaiCompatibleBaseUrl: null,
  anthropicPricingSourceUrl: "https://example.test/pricing",
  openaiPricingSourceUrl: "https://example.test/openai-pricing",
  defaultAnnotationInstruction: "",
}

/** main の代わりに状態を持つ偽の口。キーは保存したことだけを覚え、返さない */
function installFakeAiProviderApi(
  initialConsents: Partial<Record<GradingProviderId, ProviderConsent>> = {},
  providersWithApiKey: GradingProviderId[] = []
) {
  let settings: AiGradingSettings = DEFAULT_SETTINGS
  let pricing: AiPricing = {
    modelPrices: [],
    batchPricePercents: { anthropic: null, openai: null },
  }
  const modelCatalogs: ProviderModelCatalogs = { anthropic: null, openai: null }
  const statuses: Record<GradingProviderId, ProviderStatus> = {
    anthropic: {
      provider: "anthropic",
      hasApiKey: providersWithApiKey.includes("anthropic"),
      isEncryptionAvailable: true,
      consent: initialConsents.anthropic ?? null,
    },
    openai: {
      provider: "openai",
      hasApiKey: providersWithApiKey.includes("openai"),
      isEncryptionAvailable: true,
      consent: initialConsents.openai ?? null,
    },
  }
  const aiProvider = {
    getStatuses: vi.fn(async () => [
      { ...statuses.anthropic },
      { ...statuses.openai },
    ]),
    getSettings: vi.fn(async () => settings),
    recordConsent: vi.fn(async (provider: GradingProviderId) => {
      const consent: ProviderConsent = {
        userId: CURRENT_USER_ID,
        consentVersion: AI_GRADING_CONSENT_VERSION,
        consentedAt: "2026-10-05T00:00:00.000Z",
      }
      statuses[provider] = { ...statuses[provider], consent }
      return consent
    }),
    revokeConsent: vi.fn(async (provider: GradingProviderId) => {
      statuses[provider] = {
        ...statuses[provider],
        consent: null,
        hasApiKey: false,
      }
    }),
    setApiKey: vi.fn(async (provider: GradingProviderId) => {
      statuses[provider] = { ...statuses[provider], hasApiKey: true }
    }),
    clearApiKey: vi.fn(async (provider: GradingProviderId) => {
      statuses[provider] = { ...statuses[provider], hasApiKey: false }
    }),
    updateSettings: vi.fn(async (update: Partial<AiGradingSettings>) => {
      settings = { ...settings, ...update }
      return settings
    }),
    getModelCatalogs: vi.fn(async () => ({ ...modelCatalogs })),
    fetchModels: vi.fn(async (provider: GradingProviderId) => {
      const catalog = {
        fetchedAt: "2026-10-05T03:00:00.000Z",
        models: [
          {
            id: "claude-opus-5-5",
            displayName: "Claude Opus 5.5",
            createdAt: null,
            supportsAdaptiveThinking: true,
          },
          {
            id: "claude-new-6",
            displayName: "Claude New 6",
            createdAt: null,
            supportsAdaptiveThinking: true,
          },
        ],
      }
      modelCatalogs[provider] = catalog
      return { outcome: "ok", message: "", catalog }
    }),
    testConnection: vi.fn(async () => ({ outcome: "ok", message: "" })),
    openTermsLink: vi.fn(async () => undefined),
    getPricing: vi.fn(async () => pricing),
    setModelPrices: vi.fn(async (modelPrices: AiModelPrice[]) => {
      pricing = {
        ...pricing,
        modelPrices: [
          ...pricing.modelPrices.filter(
            (storedPrice) =>
              !modelPrices.some(
                (modelPrice) =>
                  modelPrice.provider === storedPrice.provider &&
                  modelPrice.model === storedPrice.model
              )
          ),
          ...modelPrices,
        ],
      }
      return pricing
    }),
    removeModelPrice: vi.fn(async () => pricing),
    setBatchPricePercent: vi.fn(
      async (provider: GradingProviderId, percent: number | null) => {
        pricing = {
          ...pricing,
          batchPricePercents: {
            ...pricing.batchPricePercents,
            [provider]: percent,
          },
        }
        return pricing
      }
    ),
    fetchPricingPage: vi.fn(async () => ({
      outcome: "ok",
      url: DEFAULT_SETTINGS.anthropicPricingSourceUrl,
      fetchedAt: "2026-10-05T03:00:00.000Z",
      contentType: "text/markdown",
      body: SYNTHETIC_PRICING_PAGE,
    })),
  }
  // 使用トークンの集計と、単価の行に並べる「使ったモデル」の元（実行は無い）
  const aiGrading = { listMyRuns: vi.fn(async () => []) }
  Object.defineProperty(window, "electronAPI", {
    value: { aiProvider, aiGrading },
    writable: true,
    configurable: true,
  })
  return aiProvider
}

/** 作り物の料金のページ（列の見出しだけ本物の形に似せる。値は作り物） */
const SYNTHETIC_PRICING_PAGE = [
  "| Model | Base input tokens | 5m cache writes | 1h cache writes | Cache hits and refreshes | Output tokens |",
  "| --- | --- | --- | --- | --- | --- |",
  "| Claude Opus 5.5 | $1 / MTok | $2 / MTok | $3 / MTok | $0.5 / MTok | $7 / MTok |",
  "| Claude Other 1 | $1 / MTok | $2 / MTok | $3 / MTok | $0.5 / MTok | $7 / MTok |",
  "| Something Else | $1 / MTok | $1 / MTok | $1 / MTok | $1 / MTok | $1 / MTok |",
].join("\n")

/** 作り物の OpenAI の料金のページ（区分の見出しと列の見出しだけ本物の形に似せる。値は作り物） */
const SYNTHETIC_OPENAI_PRICING_PAGE = [
  "### Standard pricing data",
  "| Model | Input | Cached input | Output |",
  "| --- | --- | --- | --- |",
  "| gpt-5.5 | $1.00 | $0.10 | $8.00 |",
  "",
  "### Batch pricing data",
  "| Model | Input | Cached input | Output |",
  "| --- | --- | --- | --- |",
  "| gpt-5.5 | $0.50 | $0.05 | $4.00 |",
].join("\n")

function renderTab() {
  render(<AiGradingSettingsTab />, { wrapper: createQueryWrapper() })
}

function renderDefaultsTab() {
  render(<AiGradingDefaultsTab />, { wrapper: createQueryWrapper() })
}

const CURRENT_CONSENT: ProviderConsent = {
  userId: CURRENT_USER_ID,
  consentVersion: AI_GRADING_CONSENT_VERSION,
  consentedAt: "2026-10-05T00:00:00.000Z",
}

async function findProviderSection(providerName: string) {
  return screen.findByRole("region", { name: `送信先: ${providerName}` })
}

describe("AiGradingSettingsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // cmdk は選択中の項目を scrollIntoView する。jsdom は持たない
    Element.prototype.scrollIntoView = () => {}
  })

  it("同意するまでキーの入力欄を出さず、入口と実験的機能の印だけを出す", async () => {
    installFakeAiProviderApi()
    renderTab()

    const anthropicSection = await findProviderSection("Anthropic")
    expect(
      within(anthropicSection).getByRole("button", { name: "同意の手順へ進む" })
    ).toBeTruthy()
    expect(await findProviderSection("OpenAI")).toBeTruthy()
    expect(screen.queryByLabelText("API キー")).toBeNull()
    expect(screen.queryByRole("region", { name: "AI採点の送信" })).toBeNull()
    expect(screen.getAllByText("実験的機能").length).toBeGreaterThan(0)
  })

  it("8項目をすべて確かめるまで「同意して有効にする」は押せず、同意するとキーの入力欄が現れる", async () => {
    const user = userEvent.setup()
    const aiProvider = installFakeAiProviderApi()
    renderTab()

    const anthropicSection = await findProviderSection("Anthropic")
    await user.click(
      within(anthropicSection).getByRole("button", { name: "同意の手順へ進む" })
    )

    const dialog = await screen.findByRole("dialog")
    const consentButton = within(dialog).getByRole("button", {
      name: "同意して有効にする",
    })
    const checkboxes = within(dialog).getAllByRole("checkbox")
    expect(checkboxes).toHaveLength(AI_GRADING_CONSENT_ITEMS.length)
    expect(consentButton).toBeDisabled()

    // 1つでも残っていれば押せない
    for (const checkbox of checkboxes.slice(0, -1)) {
      await user.click(checkbox)
    }
    expect(consentButton).toBeDisabled()
    // 確かめた印を外せば、また押せない状態に戻る
    await user.click(checkboxes[0])
    await user.click(checkboxes[checkboxes.length - 1])
    expect(consentButton).toBeDisabled()
    await user.click(checkboxes[0])
    expect(consentButton).toBeEnabled()

    // 規約のリンクは名前で main に頼む（URL を渡さない）
    await user.click(
      within(dialog).getByRole("button", { name: /Anthropic 商用利用規約/ })
    )
    expect(aiProvider.openTermsLink).toHaveBeenCalledWith(
      "anthropic",
      "commercial-terms"
    )

    await user.click(consentButton)

    expect(aiProvider.recordConsent).toHaveBeenCalledWith("anthropic")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(
      await within(anthropicSection).findByLabelText("API キー")
    ).toBeTruthy()
    // 同意していない OpenAI の側には、まだ入力欄が無い
    const openaiSection = await findProviderSection("OpenAI")
    expect(within(openaiSection).queryByLabelText("API キー")).toBeNull()
    // 送信の設定（同時実行数・警告額）が現れる。既定値はこのタブには無い
    expect(
      await screen.findByRole("region", { name: "AI採点の送信" })
    ).toBeTruthy()
    expect(screen.queryByRole("region", { name: "AI採点の既定値" })).toBeNull()
    expect(
      screen.queryByRole("region", { name: "助言の文案の指示の既定の文言" })
    ).toBeNull()
  })

  it("保存したキーは画面のどこにも出ず、「設定済み」と「削除」だけになる", async () => {
    const user = userEvent.setup()
    const aiProvider = installFakeAiProviderApi({
      anthropic: {
        userId: CURRENT_USER_ID,
        consentVersion: AI_GRADING_CONSENT_VERSION,
        consentedAt: "2026-10-05T00:00:00.000Z",
      },
    })
    renderTab()

    const anthropicSection = await findProviderSection("Anthropic")
    const apiKeyInput =
      await within(anthropicSection).findByLabelText("API キー")
    expect(apiKeyInput).toHaveAttribute("type", "password")

    await user.type(apiKeyInput, TEST_API_KEY)
    await user.click(
      within(anthropicSection).getByRole("button", { name: "保存" })
    )

    expect(aiProvider.setApiKey).toHaveBeenCalledWith("anthropic", TEST_API_KEY)
    expect(await within(anthropicSection).findByText("設定済み")).toBeTruthy()
    expect(
      within(anthropicSection).getByRole("button", { name: "削除" })
    ).toBeTruthy()
    expect(within(anthropicSection).queryByLabelText("API キー")).toBeNull()

    // 文字としても、入力欄の値としても残っていない
    expect(document.body.textContent ?? "").not.toContain(TEST_API_KEY)
    const inputValues = Array.from(document.querySelectorAll("input")).map(
      (input) => input.value
    )
    expect(inputValues.join("\n")).not.toContain(TEST_API_KEY)

    // 接続テストは保存したキーで main が行う
    await user.click(
      within(anthropicSection).getByRole("button", { name: "接続テスト" })
    )
    expect(aiProvider.testConnection).toHaveBeenCalledWith("anthropic")
    expect(
      await within(anthropicSection).findByText("接続できました")
    ).toBeTruthy()
  })

  it("同意文の版が古い同意・別の利用者の同意は、今の同意として扱わない", async () => {
    installFakeAiProviderApi({
      anthropic: {
        userId: CURRENT_USER_ID,
        consentVersion: "2000-01-01-old",
        consentedAt: "2000-01-01T00:00:00.000Z",
      },
      openai: {
        userId: "someone-else",
        consentVersion: AI_GRADING_CONSENT_VERSION,
        consentedAt: "2026-10-05T00:00:00.000Z",
      },
    })
    renderTab()

    for (const providerName of ["Anthropic", "OpenAI"]) {
      const section = await findProviderSection(providerName)
      expect(within(section).getByText(/改めて同意してください/)).toBeTruthy()
      expect(within(section).queryByLabelText("API キー")).toBeNull()
    }
  })

  it("「無効にする」の確認で、キーを消すこと・同意からやり直すこと・送信済みのデータは取り消せないことを示してから無効にする", async () => {
    const user = userEvent.setup()
    const aiProvider = installFakeAiProviderApi({
      anthropic: {
        userId: CURRENT_USER_ID,
        consentVersion: AI_GRADING_CONSENT_VERSION,
        consentedAt: "2026-10-05T00:00:00.000Z",
      },
    })
    renderTab()

    const anthropicSection = await findProviderSection("Anthropic")
    await user.click(
      await within(anthropicSection).findByRole("button", {
        name: "無効にする",
      })
    )

    const confirmDialog = await screen.findByRole("alertdialog")
    expect(
      within(confirmDialog).getByText("Anthropic を無効にしますか？")
    ).toBeTruthy()
    const confirmDescription =
      within(confirmDialog).getByText(/API\s+キーを削除し/)
    expect(confirmDescription).toHaveTextContent("同意から始め直してください")
    expect(confirmDescription).toHaveTextContent(
      AI_GRADING_REVOCATION_ITEM.title
    )
    await user.click(
      within(confirmDialog).getByRole("button", { name: "無効にする" })
    )

    expect(aiProvider.revokeConsent).toHaveBeenCalledWith("anthropic")
    expect(
      await within(anthropicSection).findByRole("button", {
        name: "同意の手順へ進む",
      })
    ).toBeTruthy()
  })

  it("既定値: 一覧を取得して既定のモデルを選び、Effort・処理は切り替えボタンで保存する（拡大率は選ばせない）", async () => {
    const user = userEvent.setup()
    const consent: ProviderConsent = {
      userId: CURRENT_USER_ID,
      consentVersion: AI_GRADING_CONSENT_VERSION,
      consentedAt: "2026-10-05T00:00:00.000Z",
    }
    const aiProvider = installFakeAiProviderApi(
      { anthropic: consent, openai: consent },
      ["anthropic"]
    )
    renderDefaultsTab()

    const defaultsSection = await screen.findByRole("region", {
      name: "AI採点の既定値",
    })
    const anthropicGroup = within(defaultsSection).getByRole("group", {
      name: "Anthropic のモデル",
    })
    expect(
      within(anthropicGroup).getByText("まだ取得していません")
    ).toBeTruthy()
    // キーの無い OpenAI は取得できない
    const openaiGroup = within(defaultsSection).getByRole("group", {
      name: "OpenAI のモデル",
    })
    expect(
      within(openaiGroup).getByRole("button", { name: "モデル一覧を取得" })
    ).toBeDisabled()

    await user.click(
      within(anthropicGroup).getByRole("button", { name: "モデル一覧を取得" })
    )
    expect(aiProvider.fetchModels).toHaveBeenCalledWith("anthropic")
    expect(await within(anthropicGroup).findByText(/2 件/)).toBeTruthy()

    // 手間は既定のモデル（Opus 5.5）が受け付けるので選べる
    await user.click(within(defaultsSection).getByRole("radio", { name: "高" }))
    expect(aiProvider.updateSettings).toHaveBeenLastCalledWith({
      defaultEffort: "high",
    })

    // 取得した一覧から選ぶ（名前と id が出る）
    await user.click(within(anthropicGroup).getByRole("combobox"))
    await user.click(
      await screen.findByRole("option", {
        name: /Claude New 6（claude-new-6）/,
      })
    )
    expect(aiProvider.updateSettings).toHaveBeenCalledWith({
      defaultModels: { anthropic: "claude-new-6", openai: "gpt-5.5" },
    })

    // 一覧に無い id も打って使える
    await user.click(within(anthropicGroup).getByRole("combobox"))
    await user.type(
      await screen.findByPlaceholderText("名前か id で絞り込む・id を打つ"),
      "claude-custom-x"
    )
    await user.click(
      await screen.findByRole("option", { name: /claude-custom-x.*を使う/ })
    )
    expect(aiProvider.updateSettings).toHaveBeenLastCalledWith({
      defaultModels: { anthropic: "claude-custom-x", openai: "gpt-5.5" },
    })

    // 既定の送信先は、キーのある事業者（Anthropic）を選んだ状態
    expect(
      within(defaultsSection).getByLabelText("既定の送信先")
    ).toHaveTextContent("Anthropic")

    await user.click(
      within(defaultsSection).getByRole("radio", { name: "バッチ" })
    )
    expect(aiProvider.updateSettings).toHaveBeenLastCalledWith({
      defaultMode: "batch",
    })
    // 拡大率は選ばせない（常に原寸）
    expect(
      within(defaultsSection).queryByRole("radiogroup", { name: "拡大率" })
    ).not.toBeInTheDocument()
    // 一覧にも許可リストにも無いモデルは手間を受け付けるか分からないので、選ばせない
    await waitFor(() =>
      expect(
        within(defaultsSection).getByRole("radio", { name: "高" })
      ).toBeDisabled()
    )
    expect(
      within(defaultsSection).getByText(/このモデルは Effort を受け付けません/)
    ).toBeTruthy()
  })
})

describe("AiGradingDefaultsTab（既定値）", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Element.prototype.scrollIntoView = () => {}
  })

  it("助言の文案の指示の既定の文言: 未設定なら空欄で、入力欄から離れると保存する（変えていなければ保存しない）", async () => {
    const user = userEvent.setup()
    const aiProvider = installFakeAiProviderApi({ anthropic: CURRENT_CONSENT })
    renderDefaultsTab()

    const instructionSection = await screen.findByRole("region", {
      name: "助言の文案の指示の既定の文言",
    })
    const instructionInput =
      within(instructionSection).getByLabelText("助言の文案の指示の既定の文言")
    // アプリは文言を決め打ちしない
    expect(instructionInput).toHaveValue("")

    // 触っただけでは保存しない
    await user.click(instructionInput)
    await user.tab()
    expect(aiProvider.updateSettings).not.toHaveBeenCalled()

    // 複数行のまま保存する（Enter は改行）
    await user.click(instructionInput)
    await user.type(instructionInput, "部分点の答案にだけ書く{Enter}20字以内で")
    expect(aiProvider.updateSettings).not.toHaveBeenCalled()
    await user.tab()
    expect(aiProvider.updateSettings).toHaveBeenCalledWith({
      defaultAnnotationInstruction: "部分点の答案にだけ書く\n20字以内で",
    })
    await waitFor(() =>
      expect(
        within(instructionSection).getByLabelText(
          "助言の文案の指示の既定の文言"
        )
      ).toHaveValue("部分点の答案にだけ書く\n20字以内で")
    )
  })

  it("毎回そのまま効く設定（同時実行数・警告額）は置かない", async () => {
    installFakeAiProviderApi({ anthropic: CURRENT_CONSENT })
    renderDefaultsTab()

    expect(
      await screen.findByRole("region", { name: "AI採点の既定値" })
    ).toBeTruthy()
    expect(screen.queryByLabelText(/同時実行数/)).toBeNull()
    expect(screen.queryByLabelText(/警告額/)).toBeNull()
  })
})

describe("AiGradingTabs（AI採点の画面）", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Element.prototype.scrollIntoView = () => {}
  })

  it("タブは 設定 → 既定値 → 料金 → 使用トークン の順に並ぶ", async () => {
    installFakeAiProviderApi({ anthropic: CURRENT_CONSENT })
    render(<AiGradingTabs initialTab="defaults" />, {
      wrapper: createQueryWrapper(),
    })
    const tabs = await screen.findAllByRole("tab")
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      "設定",
      "既定値",
      "料金",
      "使用トークン",
    ])
    // クエリで「既定値」を頼まれれば、既定値のタブを開く
    expect(
      await screen.findByRole("region", {
        name: "助言の文案の指示の既定の文言",
      })
    ).toBeTruthy()
  })

  it("同意するまで「既定値」「料金」「使用トークン」は押せない", async () => {
    installFakeAiProviderApi()
    render(<AiGradingTabs initialTab="pricing" />, {
      wrapper: createQueryWrapper(),
    })
    expect(await screen.findByRole("tab", { name: "料金" })).toBeDisabled()
    expect(screen.getByRole("tab", { name: "既定値" })).toBeDisabled()
    expect(screen.getByRole("tab", { name: "使用トークン" })).toBeDisabled()
    // クエリで「料金」を頼まれても、同意の入口（設定）を出す
    expect(
      await screen.findByRole("region", { name: "送信先: Anthropic" })
    ).toBeTruthy()
  })

  it("料金: ページから読み込んだ値は下書きで、保存するまで単価は変わらない", async () => {
    const user = userEvent.setup()
    const consent: ProviderConsent = {
      userId: CURRENT_USER_ID,
      consentVersion: AI_GRADING_CONSENT_VERSION,
      consentedAt: "2026-10-05T00:00:00.000Z",
    }
    const aiProvider = installFakeAiProviderApi({ anthropic: consent }, [
      "anthropic",
    ])
    render(<AiGradingTabs initialTab="pricing" />, {
      wrapper: createQueryWrapper(),
    })

    const anthropicPricing = await screen.findByRole("region", {
      name: "Anthropic の単価",
    })
    // 既定のモデルは単価未設定として並ぶ
    expect(within(anthropicPricing).getByText("単価未設定")).toBeTruthy()

    await user.click(
      within(anthropicPricing).getByRole("button", {
        name: "ページから読み込む",
      })
    )
    const draft = await screen.findByRole("region", {
      name: "読み込んだ単価の下書き",
    })
    expect(aiProvider.setModelPrices).not.toHaveBeenCalled()
    // 対応づけられなかった名前は挙げるだけ
    expect(within(draft).getByText("Something Else")).toBeTruthy()
    expect(
      within(draft).getByTestId("ai-pricing-draft-status-claude-opus-5-5")
    ).toHaveTextContent("新規")

    // 使っている（既定の）モデルの新規だけが最初に選ばれている
    await user.click(
      within(draft).getByRole("button", { name: "選んだ 1 件を保存" })
    )
    expect(aiProvider.setModelPrices).toHaveBeenCalledWith([
      {
        provider: "anthropic",
        model: "claude-opus-5-5",
        inputPerMillionUsd: 1,
        outputPerMillionUsd: 7,
        cacheReadPerMillionUsd: 0.5,
        cacheWrite5mPerMillionUsd: 2,
        cacheWrite1hPerMillionUsd: 3,
      },
    ])
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "読み込んだ単価の下書き" })
      ).toBeNull()
    )
  })

  it("料金: OpenAI も自分の読み込み元から読み、下書きを OpenAI の単価とバッチの割合として保存する", async () => {
    const user = userEvent.setup()
    const consent: ProviderConsent = {
      userId: CURRENT_USER_ID,
      consentVersion: AI_GRADING_CONSENT_VERSION,
      consentedAt: "2026-10-05T00:00:00.000Z",
    }
    const aiProvider = installFakeAiProviderApi({ openai: consent }, ["openai"])
    aiProvider.fetchPricingPage.mockResolvedValueOnce({
      outcome: "ok",
      url: DEFAULT_SETTINGS.openaiPricingSourceUrl,
      fetchedAt: "2026-10-05T03:00:00.000Z",
      contentType: "text/markdown",
      body: SYNTHETIC_OPENAI_PRICING_PAGE,
    })
    render(<AiGradingTabs initialTab="pricing" />, {
      wrapper: createQueryWrapper(),
    })

    const openaiPricing = await screen.findByRole("region", {
      name: "OpenAI の単価",
    })
    expect(
      within(openaiPricing).getByLabelText("読み込み元（https）")
    ).toHaveValue(DEFAULT_SETTINGS.openaiPricingSourceUrl)
    await user.click(
      within(openaiPricing).getByRole("button", {
        name: "ページから読み込む",
      })
    )
    expect(aiProvider.fetchPricingPage).toHaveBeenCalledWith("openai")
    const draft = await screen.findByRole("region", {
      name: "読み込んだ単価の下書き",
    })
    await user.click(
      within(draft).getByRole("button", { name: "選んだ 1 件を保存" })
    )
    expect(aiProvider.setModelPrices).toHaveBeenCalledWith([
      {
        provider: "openai",
        model: "gpt-5.5",
        inputPerMillionUsd: 1,
        outputPerMillionUsd: 8,
        cacheReadPerMillionUsd: 0.1,
        cacheWrite5mPerMillionUsd: 1,
        cacheWrite1hPerMillionUsd: 1,
      },
    ])
    expect(aiProvider.setBatchPricePercent).toHaveBeenCalledWith("openai", 50)
  })

  it("料金: 読み込めなかったときは理由を出し、何も保存しない", async () => {
    const user = userEvent.setup()
    const consent: ProviderConsent = {
      userId: CURRENT_USER_ID,
      consentVersion: AI_GRADING_CONSENT_VERSION,
      consentedAt: "2026-10-05T00:00:00.000Z",
    }
    const aiProvider = installFakeAiProviderApi({ anthropic: consent })
    aiProvider.fetchPricingPage.mockResolvedValueOnce({
      outcome: "ok",
      url: DEFAULT_SETTINGS.anthropicPricingSourceUrl,
      fetchedAt: "2026-10-05T03:00:00.000Z",
      contentType: "text/html",
      body: "<html></html>",
    })
    render(<AiGradingTabs initialTab="pricing" />, {
      wrapper: createQueryWrapper(),
    })
    await user.click(
      await screen.findByRole("button", { name: "ページから読み込む" })
    )
    expect(
      await screen.findByText("読み込めませんでした（手入力してください）")
    ).toBeTruthy()
    expect(aiProvider.setModelPrices).not.toHaveBeenCalled()
  })
})
