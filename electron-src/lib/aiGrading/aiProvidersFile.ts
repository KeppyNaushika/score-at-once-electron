/**
 * `userData/ai-providers.json` の中身の形・既定値と、読んだ中身の検証・正規化
 * （`providerCredentialStore.ts` が読み書きに使う）。
 *
 * 読んだ値は正しいものだけを残し、崩れた所は既定値・空に戻す。設定の変更は
 * 正しくない項目を名指しで返し、拒否するかどうかは保存の口が決める。
 */

import { isAiGradingRunMode } from "@/types/aiGrading.types"

import type {
  AiGradingSettings,
  AiModelPrice,
  AiPricing,
  ProviderConsent,
  ProviderModelCatalog,
  ProviderModelCatalogs,
} from "./providerCredentialStore"
import type { GradingProviderId, ProviderModelInfo } from "./providers/types"
import {
  GRADING_PROVIDER_IDS,
  isGradingEffort,
  isGradingProviderId,
} from "./providers/types"

/** 事業者ごとに保存するもの */
export interface StoredProviderEntry {
  /** `safeStorage.encryptString` の結果を base64 にしたもの */
  encryptedApiKey: string | null
  consent: ProviderConsent | null
}

/** ファイルの中身 */
export interface AiProvidersFile {
  version: 1
  providers: Record<GradingProviderId, StoredProviderEntry>
  settings: AiGradingSettings
  modelCatalogs: ProviderModelCatalogs
  pricing: AiPricing
}

const CONCURRENCY_MIN = 1
const CONCURRENCY_MAX = 16

const DEFAULT_SETTINGS: AiGradingSettings = {
  defaultProvider: "anthropic",
  // OpenAI の既定は仮の値。P0 の実測で決める（設計 §3-3）
  defaultModels: { anthropic: "claude-opus-5-5", openai: "gpt-5.5" },
  defaultEffort: "medium",
  defaultMode: "realtime",
  concurrency: 4,
  budgetWarningUsd: null,
  openaiCompatibleBaseUrl: null,
  anthropicPricingSourceUrl:
    "https://platform.claude.com/docs/ja/about-claude/pricing",
  openaiPricingSourceUrl: "https://developers.openai.com/api/docs/pricing",
  // アプリは文言を決め打ちしない。入れていなければ空欄（設計 §3-1）
  defaultAnnotationInstruction: "",
}

export function createEmptyEntry(): StoredProviderEntry {
  return { encryptedApiKey: null, consent: null }
}

export function createDefaultFile(): AiProvidersFile {
  return {
    version: 1,
    providers: {
      anthropic: createEmptyEntry(),
      openai: createEmptyEntry(),
    },
    settings: {
      ...DEFAULT_SETTINGS,
      defaultModels: { ...DEFAULT_SETTINGS.defaultModels },
    },
    modelCatalogs: { anthropic: null, openai: null },
    pricing: createEmptyPricing(),
  }
}

/** 単価を何も入れていない状態 */
function createEmptyPricing(): AiPricing {
  return {
    modelPrices: [],
    batchPricePercents: { anthropic: null, openai: null },
  }
}

function isRecord(candidate: unknown): candidate is Record<string, unknown> {
  return (
    typeof candidate === "object" &&
    candidate !== null &&
    !Array.isArray(candidate)
  )
}

export function isNonEmptyString(candidate: unknown): candidate is string {
  return typeof candidate === "string" && candidate.trim() !== ""
}

function isValidConcurrency(candidate: unknown): candidate is number {
  return (
    typeof candidate === "number" &&
    Number.isInteger(candidate) &&
    candidate >= CONCURRENCY_MIN &&
    candidate <= CONCURRENCY_MAX
  )
}

function isValidBudget(candidate: unknown): candidate is number | null {
  return (
    candidate === null ||
    (typeof candidate === "number" &&
      Number.isFinite(candidate) &&
      candidate >= 0)
  )
}

function isValidBaseUrl(candidate: unknown): candidate is string | null {
  if (candidate === null) return true
  if (typeof candidate !== "string") return false
  try {
    const url = new URL(candidate)
    return url.protocol === "https:" || url.protocol === "http:"
  } catch {
    return false
  }
}

function isValidUnitPrice(candidate: unknown): candidate is number {
  return (
    typeof candidate === "number" &&
    Number.isFinite(candidate) &&
    candidate >= 0
  )
}

export function isValidBatchPricePercent(
  candidate: unknown
): candidate is number | null {
  return (
    candidate === null ||
    (typeof candidate === "number" &&
      Number.isFinite(candidate) &&
      candidate >= 0 &&
      candidate <= 100)
  )
}

/** 単価1行を確かめる。形が崩れていれば null（項目を名指しで組み、余計な項目を持たない） */
export function toModelPrice(candidate: unknown): AiModelPrice | null {
  if (!isRecord(candidate)) return null
  const {
    provider,
    model,
    inputPerMillionUsd,
    outputPerMillionUsd,
    cacheReadPerMillionUsd,
    cacheWrite5mPerMillionUsd,
    cacheWrite1hPerMillionUsd,
  } = candidate
  if (
    !isGradingProviderId(provider) ||
    !isNonEmptyString(model) ||
    !isValidUnitPrice(inputPerMillionUsd) ||
    !isValidUnitPrice(outputPerMillionUsd) ||
    !isValidUnitPrice(cacheReadPerMillionUsd) ||
    !isValidUnitPrice(cacheWrite5mPerMillionUsd) ||
    !isValidUnitPrice(cacheWrite1hPerMillionUsd)
  ) {
    return null
  }
  return {
    provider,
    model: model.trim(),
    inputPerMillionUsd,
    outputPerMillionUsd,
    cacheReadPerMillionUsd,
    cacheWrite5mPerMillionUsd,
    cacheWrite1hPerMillionUsd,
  }
}

/** 読んだ単価を確かめる。崩れた行だけを捨て、同じモデルが重なれば後の行を残す */
function toPricing(candidate: unknown): AiPricing {
  const pricing = createEmptyPricing()
  if (!isRecord(candidate)) return pricing
  const storedPrices = Array.isArray(candidate.modelPrices)
    ? candidate.modelPrices
    : []
  const priceByKey = new Map<string, AiModelPrice>()
  storedPrices.forEach((storedPrice) => {
    const modelPrice = toModelPrice(storedPrice)
    if (modelPrice) {
      priceByKey.set(
        modelPriceKey(modelPrice.provider, modelPrice.model),
        modelPrice
      )
    }
  })
  const storedPercents = isRecord(candidate.batchPricePercents)
    ? candidate.batchPricePercents
    : {}
  return {
    modelPrices: [...priceByKey.values()],
    batchPricePercents: {
      anthropic: isValidBatchPricePercent(storedPercents.anthropic)
        ? storedPercents.anthropic
        : null,
      openai: isValidBatchPricePercent(storedPercents.openai)
        ? storedPercents.openai
        : null,
    },
  }
}

/** 単価の行を見分けるキー（事業者とモデルの組） */
export function modelPriceKey(
  provider: GradingProviderId,
  model: string
): string {
  return JSON.stringify([provider, model])
}

function isValidHttpsUrl(candidate: unknown): candidate is string {
  if (typeof candidate !== "string") return false
  try {
    return new URL(candidate).protocol === "https:"
  } catch {
    return false
  }
}

function toConsent(candidate: unknown): ProviderConsent | null {
  if (!isRecord(candidate)) return null
  const { userId, consentVersion, consentedAt } = candidate
  if (
    !isNonEmptyString(userId) ||
    !isNonEmptyString(consentVersion) ||
    !isNonEmptyString(consentedAt)
  ) {
    return null
  }
  return { userId, consentVersion, consentedAt }
}

function toProviderEntry(candidate: unknown): StoredProviderEntry {
  if (!isRecord(candidate)) return createEmptyEntry()
  return {
    encryptedApiKey: isNonEmptyString(candidate.encryptedApiKey)
      ? candidate.encryptedApiKey
      : null,
    consent: toConsent(candidate.consent),
  }
}

export function toModelInfo(candidate: unknown): ProviderModelInfo | null {
  if (!isRecord(candidate)) return null
  const { id, displayName, createdAt, supportsAdaptiveThinking } = candidate
  if (
    !isNonEmptyString(id) ||
    typeof displayName !== "string" ||
    !(createdAt === null || isNonEmptyString(createdAt)) ||
    !(
      supportsAdaptiveThinking === null ||
      typeof supportsAdaptiveThinking === "boolean"
    )
  ) {
    return null
  }
  return { id, displayName, createdAt, supportsAdaptiveThinking }
}

/** 読んだモデルの一覧を確かめる。1件でも形が崩れていれば一覧ごと捨てる（取得し直せばよい） */
function toModelCatalog(candidate: unknown): ProviderModelCatalog | null {
  if (!isRecord(candidate)) return null
  const { fetchedAt, models } = candidate
  if (!isNonEmptyString(fetchedAt) || !Array.isArray(models)) return null
  const modelInfos = models.map(toModelInfo)
  if (modelInfos.some((modelInfo) => modelInfo === null)) return null
  return {
    fetchedAt,
    models: modelInfos.flatMap((modelInfo) => (modelInfo ? [modelInfo] : [])),
  }
}

function toModelCatalogs(candidate: unknown): ProviderModelCatalogs {
  const catalogs = isRecord(candidate) ? candidate : {}
  return {
    anthropic: toModelCatalog(catalogs.anthropic),
    openai: toModelCatalog(catalogs.openai),
  }
}

/** 読んだ設定のうち、正しい値だけを既定値に重ねる */
function toSettings(candidate: unknown): AiGradingSettings {
  const settings = createDefaultFile().settings
  if (!isRecord(candidate)) return settings
  const storedModels = isRecord(candidate.defaultModels)
    ? candidate.defaultModels
    : {}
  return {
    defaultProvider: isGradingProviderId(candidate.defaultProvider)
      ? candidate.defaultProvider
      : settings.defaultProvider,
    defaultModels: {
      anthropic: isNonEmptyString(storedModels.anthropic)
        ? storedModels.anthropic
        : settings.defaultModels.anthropic,
      openai: isNonEmptyString(storedModels.openai)
        ? storedModels.openai
        : settings.defaultModels.openai,
    },
    defaultEffort: isGradingEffort(candidate.defaultEffort)
      ? candidate.defaultEffort
      : settings.defaultEffort,
    defaultMode: isAiGradingRunMode(candidate.defaultMode)
      ? candidate.defaultMode
      : settings.defaultMode,
    concurrency: isValidConcurrency(candidate.concurrency)
      ? candidate.concurrency
      : settings.concurrency,
    budgetWarningUsd: isValidBudget(candidate.budgetWarningUsd)
      ? candidate.budgetWarningUsd
      : settings.budgetWarningUsd,
    openaiCompatibleBaseUrl: isValidBaseUrl(candidate.openaiCompatibleBaseUrl)
      ? candidate.openaiCompatibleBaseUrl
      : settings.openaiCompatibleBaseUrl,
    anthropicPricingSourceUrl: isValidHttpsUrl(
      candidate.anthropicPricingSourceUrl
    )
      ? candidate.anthropicPricingSourceUrl
      : settings.anthropicPricingSourceUrl,
    openaiPricingSourceUrl: isValidHttpsUrl(candidate.openaiPricingSourceUrl)
      ? candidate.openaiPricingSourceUrl
      : settings.openaiPricingSourceUrl,
    defaultAnnotationInstruction:
      typeof candidate.defaultAnnotationInstruction === "string"
        ? candidate.defaultAnnotationInstruction
        : settings.defaultAnnotationInstruction,
  }
}

export function toAiProvidersFile(candidate: unknown): AiProvidersFile {
  if (!isRecord(candidate)) return createDefaultFile()
  const providers = isRecord(candidate.providers) ? candidate.providers : {}
  return {
    version: 1,
    providers: {
      anthropic: toProviderEntry(providers.anthropic),
      openai: toProviderEntry(providers.openai),
    },
    settings: toSettings(candidate.settings),
    modelCatalogs: toModelCatalogs(candidate.modelCatalogs),
    pricing: toPricing(candidate.pricing),
  }
}

/** 設定の変更のうち、正しくない値の項目名（無ければ空） */
export function listInvalidSettingsFields(
  update: Partial<AiGradingSettings>
): string[] {
  return [
    update.defaultProvider !== undefined &&
    !isGradingProviderId(update.defaultProvider)
      ? "defaultProvider"
      : null,
    update.defaultModels !== undefined &&
    !GRADING_PROVIDER_IDS.every((providerId) =>
      isNonEmptyString(update.defaultModels?.[providerId])
    )
      ? "defaultModels"
      : null,
    update.defaultEffort !== undefined && !isGradingEffort(update.defaultEffort)
      ? "defaultEffort"
      : null,
    update.defaultMode !== undefined && !isAiGradingRunMode(update.defaultMode)
      ? "defaultMode"
      : null,
    update.concurrency !== undefined && !isValidConcurrency(update.concurrency)
      ? "concurrency"
      : null,
    update.budgetWarningUsd !== undefined &&
    !isValidBudget(update.budgetWarningUsd)
      ? "budgetWarningUsd"
      : null,
    update.openaiCompatibleBaseUrl !== undefined &&
    !isValidBaseUrl(update.openaiCompatibleBaseUrl)
      ? "openaiCompatibleBaseUrl"
      : null,
    update.anthropicPricingSourceUrl !== undefined &&
    !isValidHttpsUrl(update.anthropicPricingSourceUrl)
      ? "anthropicPricingSourceUrl"
      : null,
    update.openaiPricingSourceUrl !== undefined &&
    !isValidHttpsUrl(update.openaiPricingSourceUrl)
      ? "openaiPricingSourceUrl"
      : null,
    update.defaultAnnotationInstruction !== undefined &&
    typeof update.defaultAnnotationInstruction !== "string"
      ? "defaultAnnotationInstruction"
      : null,
  ].filter((problem) => problem !== null)
}
