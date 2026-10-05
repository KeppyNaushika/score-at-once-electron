// @vitest-environment jsdom
/**
 * 「実験的機能：AI採点」タブ（docs/vlm-grading-design.md §9）。
 *
 * ここで固定すること:
 * - 同意するまでキーの入力欄を出さない（入口と説明だけ）
 * - 同意は8項目を1つずつ確かめないと押せない（読み飛ばせない）
 * - 同意すると、その事業者のキーの入力欄が現れる
 * - 保存したキーは画面のどこにも出ない（「設定済み」と「削除」だけ）
 * - 同意文の版が変わった同意は、今の同意として扱わない
 * - 取り消しの確認で、送信済みのものは戻らないこと（8項目目）を示す
 *
 * window.electronAPI は偽物で、ネットワークにも実際のキーにも触れない。
 */

import "../setup"

import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AiGradingSettingsTab } from "@/app/(app)/settings/components/AiGradingSettingsTab"
import type {
  AiGradingSettings,
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
}

/** main の代わりに状態を持つ偽の口。キーは保存したことだけを覚え、返さない */
function installFakeAiProviderApi(
  initialConsents: Partial<Record<GradingProviderId, ProviderConsent>> = {},
  providersWithApiKey: GradingProviderId[] = []
) {
  let settings: AiGradingSettings = DEFAULT_SETTINGS
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
  }
  Object.defineProperty(window, "electronAPI", {
    value: { aiProvider },
    writable: true,
    configurable: true,
  })
  return aiProvider
}

function renderTab() {
  render(<AiGradingSettingsTab />, { wrapper: createQueryWrapper() })
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
    expect(screen.queryByRole("region", { name: "AI採点の既定値" })).toBeNull()
    expect(screen.getAllByText("実験的機能").length).toBeGreaterThan(0)
  })

  it("8項目をすべて確かめるまで「同意して解放」は押せず、同意するとキーの入力欄が現れる", async () => {
    const user = userEvent.setup()
    const aiProvider = installFakeAiProviderApi()
    renderTab()

    const anthropicSection = await findProviderSection("Anthropic")
    await user.click(
      within(anthropicSection).getByRole("button", { name: "同意の手順へ進む" })
    )

    const dialog = await screen.findByRole("dialog")
    const consentButton = within(dialog).getByRole("button", {
      name: "同意して解放",
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
    // 既定値の欄が現れる
    expect(
      await screen.findByRole("region", { name: "AI採点の既定値" })
    ).toBeTruthy()
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

  it("取り消しの確認で、送信済みのものは戻らないことを示してから取り消す", async () => {
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
        name: "同意を取り消す",
      })
    )

    const confirmDialog = await screen.findByRole("alertdialog")
    expect(
      within(confirmDialog).getByText(AI_GRADING_REVOCATION_ITEM.body)
    ).toBeTruthy()
    await user.click(
      within(confirmDialog).getByRole("button", { name: "同意を取り消す" })
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
    renderTab()

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
