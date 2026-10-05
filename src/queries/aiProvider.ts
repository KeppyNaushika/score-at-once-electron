import { queryOptions } from "@tanstack/react-query"

import type {
  AiGradingSettings,
  AiModelPrice,
} from "@/electron-src/lib/aiGrading/providerCredentialStore"
import type { GradingProviderId } from "@/electron-src/lib/aiGrading/providers/types"

import { defineMutation } from "./defineMutation"

/**
 * AI 採点（実験的機能）の、事業者ごとの同意・API キーの有無・既定値。
 *
 * 対応する preload は `electron-src/preload-apis/aiProviderApi.ts`。
 * 保存先は端末ごとの `userData/ai-providers.json` で、DB ではない。
 * **API キーを読み出す取得は無い**（あるのは「キーがあるか」だけ）。
 */

// =====================================================================
// 取得
// =====================================================================

/** 事業者ごとの状態（キーがあるか・暗号化できるか・同意の記録） */
export const aiProviderStatusesQuery = () =>
  queryOptions({
    queryKey: ["aiProvider", "statuses"] as const,
    queryFn: () => window.electronAPI.aiProvider.getStatuses(),
  })

/** 機密でない既定値（モデル・effort・同時実行数・送信1回の見積もりの警告額） */
export const aiGradingSettingsQuery = () =>
  queryOptions({
    queryKey: ["aiProvider", "settings"] as const,
    queryFn: () => window.electronAPI.aiProvider.getSettings(),
  })

/** 事業者ごとの、取得しておいたモデルの一覧（まだ取得していなければ null） */
export const aiModelCatalogsQuery = () =>
  queryOptions({
    queryKey: ["aiProvider", "modelCatalogs"] as const,
    queryFn: () => window.electronAPI.aiProvider.getModelCatalogs(),
  })

/** 利用者が入れた単価（費用の計算はすべてこれで行う。入れていなければ空） */
export const aiPricingQuery = () =>
  queryOptions({
    queryKey: ["aiProvider", "pricing"] as const,
    queryFn: () => window.electronAPI.aiProvider.getPricing(),
  })

// =====================================================================
// 書き込み
// =====================================================================

/** 同意を記録する。同意した人と同意文の版は main が決める */
export const recordAiProviderConsentMutation = () =>
  defineMutation({
    mutationFn: (provider: GradingProviderId) =>
      window.electronAPI.aiProvider.recordConsent(provider),
    meta: {
      invalidates: [aiProviderStatusesQuery().queryKey],
      errorMessage: "同意を記録できませんでした",
    },
  })

/** 同意を取り消す。保存した API キーも消える */
export const revokeAiProviderConsentMutation = () =>
  defineMutation({
    mutationFn: (provider: GradingProviderId) =>
      window.electronAPI.aiProvider.revokeConsent(provider),
    meta: {
      invalidates: [aiProviderStatusesQuery().queryKey],
      errorMessage: "同意を取り消せませんでした",
    },
  })

/** API キーを暗号化して保存する */
export const setAiProviderApiKeyMutation = () =>
  defineMutation({
    mutationFn: (input: { provider: GradingProviderId; apiKey: string }) =>
      window.electronAPI.aiProvider.setApiKey(input.provider, input.apiKey),
    meta: {
      invalidates: [aiProviderStatusesQuery().queryKey],
      errorMessage: "API キーを保存できませんでした",
    },
  })

/** 保存した API キーを消す */
export const clearAiProviderApiKeyMutation = () =>
  defineMutation({
    mutationFn: (provider: GradingProviderId) =>
      window.electronAPI.aiProvider.clearApiKey(provider),
    meta: {
      invalidates: [aiProviderStatusesQuery().queryKey],
      errorMessage: "API キーを削除できませんでした",
    },
  })

/** 既定値を変える（渡した項目だけ） */
export const updateAiGradingSettingsMutation = () =>
  defineMutation({
    mutationFn: (update: Partial<AiGradingSettings>) =>
      window.electronAPI.aiProvider.updateSettings(update),
    meta: {
      invalidates: [aiGradingSettingsQuery().queryKey],
      errorMessage: "AI 採点の既定値を保存できませんでした",
    },
  })

/** 保存したキーで事業者へつながるか試す。何も書かない */
export const testAiProviderConnectionMutation = () =>
  defineMutation({
    mutationFn: (provider: GradingProviderId) =>
      window.electronAPI.aiProvider.testConnection(provider),
    meta: {
      writesDatabase: false,
      errorMessage: "接続テストを実行できませんでした",
    },
  })

/**
 * 保存したキーで事業者からモデルの一覧を取得し、端末の設定ファイルへ保存する（DB は書かない）。
 * つながらないなどの失敗は投げずに種類で返る
 */
export const fetchAiProviderModelsMutation = () =>
  defineMutation({
    mutationFn: (provider: GradingProviderId) =>
      window.electronAPI.aiProvider.fetchModels(provider),
    meta: {
      invalidates: [aiModelCatalogsQuery().queryKey],
      errorMessage: "モデルの一覧を取得できませんでした",
    },
  })

/** 事業者の規約のページを既定のブラウザで開く。何も書かない */
export const openAiProviderTermsLinkMutation = () =>
  defineMutation({
    mutationFn: (input: { provider: GradingProviderId; linkKey: string }) =>
      window.electronAPI.aiProvider.openTermsLink(
        input.provider,
        input.linkKey
      ),
    meta: {
      writesDatabase: false,
      errorMessage: "規約のページを開けませんでした",
    },
  })

/** モデルの単価を入れる（端末の設定ファイルへ。1行でも正しくなければ何も変えない） */
export const setAiModelPricesMutation = () =>
  defineMutation({
    mutationFn: (modelPrices: AiModelPrice[]) =>
      window.electronAPI.aiProvider.setModelPrices(modelPrices),
    meta: {
      invalidates: [aiPricingQuery().queryKey],
      errorMessage: "単価を保存できませんでした",
    },
  })

/** モデル1つの単価を消す */
export const removeAiModelPriceMutation = () =>
  defineMutation({
    mutationFn: (input: { provider: GradingProviderId; model: string }) =>
      window.electronAPI.aiProvider.removeModelPrice(
        input.provider,
        input.model
      ),
    meta: {
      invalidates: [aiPricingQuery().queryKey],
      errorMessage: "単価を消せませんでした",
    },
  })

/** 事業者のバッチの単価が通常の何 % かを入れる（null で未設定） */
export const setAiBatchPricePercentMutation = () =>
  defineMutation({
    mutationFn: (input: {
      provider: GradingProviderId
      percent: number | null
    }) =>
      window.electronAPI.aiProvider.setBatchPricePercent(
        input.provider,
        input.percent
      ),
    meta: {
      invalidates: [aiPricingQuery().queryKey],
      errorMessage: "バッチの割合を保存できませんでした",
    },
  })

/**
 * 設定にある料金のページを取ってくる（本文をそのまま返す。何も書かない）。
 * 読めなかったときも投げずに種類で返る
 */
export const fetchAiPricingPageMutation = () =>
  defineMutation({
    mutationFn: () => window.electronAPI.aiProvider.fetchPricingPage(),
    meta: {
      writesDatabase: false,
      errorMessage: "料金のページを読み込めませんでした",
    },
  })
