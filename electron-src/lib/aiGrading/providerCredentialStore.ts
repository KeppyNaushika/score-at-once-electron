/**
 * AI 採点の事業者ごとの API キーと同意、機密でない既定値の保存（設計 §9）。
 *
 * 端末ごとの設定なので、同期される DB ではなく `userData/ai-providers.json` に置く
 * （`sync/syncConfig.ts` と同じ考え方）。API キーは Electron の `safeStorage` で暗号化し、
 * 暗号化できない環境では保存を拒否する。
 *
 * **復号したキーを返すのは `readApiKeyForMainProcessOnly` だけで、これは main の中で
 * 事業者のクライアントを作るためだけに使う。IPC のハンドラから呼んで値を返してはならない。**
 * IPC へ出すのは `getProviderStatus`（キーがあるかどうか）だけにする。
 *
 * 事業者から取得したモデルの一覧（`modelCatalogs`）も同じファイルに置く。機密ではなく、
 * キーも含めない（一覧は事業者が返した id・名前・日時・能力だけ）。
 *
 * 費用の計算に使う単価（`pricing`）も同じファイルに置く。**単価は利用者が入れた値だけで、
 * アプリは単価を持たない**（事業者の料金は変わるし、契約でも違う）。入れていなければ空。
 */

import { app, safeStorage } from "electron"
import * as fs from "fs"
import * as path from "path"

import {
  type AiGradingRunMode,
  isAiGradingRunMode,
} from "@/types/aiGrading.types"

import type {
  GradingEffort,
  GradingProviderId,
  ProviderModelInfo,
} from "./providers/types"
import {
  GRADING_PROVIDER_IDS,
  isGradingEffort,
  isGradingProviderId,
} from "./providers/types"

/** 同意の記録。その端末で、その利用者が、その版の同意文に同意した */
export interface ProviderConsent {
  userId: string
  consentVersion: string
  /** ISO 8601 */
  consentedAt: string
}

/** 事業者ごとに保存するもの */
interface StoredProviderEntry {
  /** `safeStorage.encryptString` の結果を base64 にしたもの */
  encryptedApiKey: string | null
  consent: ProviderConsent | null
}

/** 機密でない既定値 */
export interface AiGradingSettings {
  defaultProvider: GradingProviderId
  defaultModels: Record<GradingProviderId, string>
  defaultEffort: GradingEffort
  /** 既定の送り方（その場か、バッチか） */
  defaultMode: AiGradingRunMode
  /** その場の採点で同時に投げる数 */
  concurrency: number
  /**
   * 送信1回の見積もりの警告額（米ドル）。送信前の概算がこれを超えると警告する。
   * 月の予算ではない（月ごとの上限は持たない）。null なら警告しない
   */
  budgetWarningUsd: number | null
  /** OpenAI 互換の接続先。null なら使わない */
  openaiCompatibleBaseUrl: string | null
  /**
   * 「料金」タブの「ページから読み込む」で読む、Anthropic の料金のページ（https だけ）。
   * 読んだ値は下書きとして見せるだけで、教員が保存するまで単価は変わらない
   */
  anthropicPricingSourceUrl: string
}

/** 事業者から取得したモデルの一覧 */
export interface ProviderModelCatalog {
  /** 取得した日時（ISO 8601） */
  fetchedAt: string
  models: ProviderModelInfo[]
}

/** 事業者ごとのモデルの一覧。まだ取得していなければ null */
export type ProviderModelCatalogs = Record<
  GradingProviderId,
  ProviderModelCatalog | null
>

/** モデル1つの単価（100万トークンあたりの米ドル）。利用者が入れた値 */
export interface AiModelPrice {
  /** 実行の `provider` 列と同じ値 */
  provider: GradingProviderId
  /** 実行の `model` 列と同じ値（事業者のモデルの id） */
  model: string
  inputPerMillionUsd: number
  outputPerMillionUsd: number
  /** キャッシュから読んだ入力 */
  cacheReadPerMillionUsd: number
  /**
   * キャッシュへ書いた入力（5分の保持）。その場の送信はこの保持で書く
   * （`providers/anthropicProvider.ts`）。書き込みに別の料金の無い事業者は 0
   */
  cacheWrite5mPerMillionUsd: number
  /** キャッシュへ書いた入力（1時間の保持）。バッチはこの保持で書く。別の料金が無ければ 0 */
  cacheWrite1hPerMillionUsd: number
}

/** 費用の計算に使う単価。どれも利用者が入れた値で、入れていなければ空 */
export interface AiPricing {
  modelPrices: AiModelPrice[]
  /**
   * 事業者ごとの、バッチで送ったときの単価が通常の何 % か（0〜100）。入力・出力・
   * キャッシュの読み書きのすべての欄に掛ける。null なら未設定で、バッチの実行の費用は出さない
   */
  batchPricePercents: Record<GradingProviderId, number | null>
}

/** ファイルの中身 */
interface AiProvidersFile {
  version: 1
  providers: Record<GradingProviderId, StoredProviderEntry>
  settings: AiGradingSettings
  modelCatalogs: ProviderModelCatalogs
  pricing: AiPricing
}

/** 事業者ごとの状態（IPC へ出してよい形。キーそのものは含めない） */
export interface ProviderStatus {
  provider: GradingProviderId
  hasApiKey: boolean
  isEncryptionAvailable: boolean
  consent: ProviderConsent | null
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
}

/** 保存・読み出しの失敗の種類 */
export type ProviderCredentialErrorCode =
  | "encryption_unavailable"
  | "consent_required"
  | "invalid_api_key"
  | "invalid_settings"
  | "decryption_failed"

/** 保存・読み出しを拒否・失敗したことを表す */
export class ProviderCredentialError extends Error {
  readonly code: ProviderCredentialErrorCode

  constructor(
    code: ProviderCredentialErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = "ProviderCredentialError"
    this.code = code
  }
}

/** 暗号化の口（Electron の `safeStorage` と同じ形。テストでは偽物を渡す） */
export interface CredentialEncryption {
  isEncryptionAvailable(): boolean
  encryptString(plainText: string): Buffer
  decryptString(encrypted: Buffer): string
}

interface ProviderCredentialStoreDependencies {
  configFilePath: string
  encryption: CredentialEncryption
  /** 同意の日時に使う（テストで固定する） */
  now?: () => Date
}

function createEmptyEntry(): StoredProviderEntry {
  return { encryptedApiKey: null, consent: null }
}

function createDefaultFile(): AiProvidersFile {
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

function isNonEmptyString(candidate: unknown): candidate is string {
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

function isValidBatchPricePercent(
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
function toModelPrice(candidate: unknown): AiModelPrice | null {
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
function modelPriceKey(provider: GradingProviderId, model: string): string {
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

function toModelInfo(candidate: unknown): ProviderModelInfo | null {
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
  }
}

function toAiProvidersFile(candidate: unknown): AiProvidersFile {
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

/** 設定の変更を確かめる。正しくない値が1つでもあれば全体を拒否する */
function assertValidSettingsUpdate(update: Partial<AiGradingSettings>): void {
  const problems = [
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
  ].filter((problem) => problem !== null)
  if (problems.length > 0) {
    throw new ProviderCredentialError(
      "invalid_settings",
      `設定の値が正しくありません: ${problems.join(", ")}`
    )
  }
}

/**
 * 保存の口を作る。ファイルの置き場所と暗号化の口を外から渡す（テストは Electron 無しで動かす）。
 * アプリでは `getProviderCredentialStore()` を使う
 */
export function createProviderCredentialStore(
  dependencies: ProviderCredentialStoreDependencies
) {
  const { configFilePath, encryption } = dependencies
  const now = dependencies.now ?? (() => new Date())

  function loadFile(): AiProvidersFile {
    try {
      if (fs.existsSync(configFilePath)) {
        const parsed: unknown = JSON.parse(
          fs.readFileSync(configFilePath, "utf-8")
        )
        return toAiProvidersFile(parsed)
      }
    } catch (error) {
      console.error("Failed to load AI provider config:", error)
    }
    return createDefaultFile()
  }

  /** 書きかけのファイルが残らないよう、一時ファイルに書いてから置き換える */
  function saveFile(file: AiProvidersFile): void {
    const directory = path.dirname(configFilePath)
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true })
    }
    const temporaryPath = `${configFilePath}.tmp`
    fs.writeFileSync(temporaryPath, JSON.stringify(file, null, 2), {
      encoding: "utf-8",
      mode: 0o600,
    })
    fs.renameSync(temporaryPath, configFilePath)
  }

  function updateProviderEntry(
    provider: GradingProviderId,
    update: (entry: StoredProviderEntry) => StoredProviderEntry
  ): void {
    const file = loadFile()
    saveFile({
      ...file,
      providers: {
        ...file.providers,
        [provider]: update(file.providers[provider]),
      },
    })
  }

  /** 事業者の状態（キーがあるか・同意）。キーそのものは返さない */
  function getProviderStatus(provider: GradingProviderId): ProviderStatus {
    const entry = loadFile().providers[provider]
    return {
      provider,
      hasApiKey: entry.encryptedApiKey !== null,
      isEncryptionAvailable: encryption.isEncryptionAvailable(),
      consent: entry.consent,
    }
  }

  /** 全事業者の状態 */
  function getProviderStatuses(): ProviderStatus[] {
    return GRADING_PROVIDER_IDS.map(getProviderStatus)
  }

  /**
   * API キーを暗号化して保存する。同意していない事業者・暗号化できない環境では拒否する
   *
   * @throws {ProviderCredentialError}
   */
  function setApiKey(provider: GradingProviderId, apiKey: string): void {
    const trimmedApiKey = apiKey.trim()
    if (trimmedApiKey === "") {
      throw new ProviderCredentialError("invalid_api_key", "API キーが空です")
    }
    if (!encryption.isEncryptionAvailable()) {
      throw new ProviderCredentialError(
        "encryption_unavailable",
        "この環境では API キーを暗号化して保存できないため、保存しません"
      )
    }
    if (loadFile().providers[provider].consent === null) {
      throw new ProviderCredentialError(
        "consent_required",
        "同意していない事業者のキーは保存できません"
      )
    }
    const encryptedApiKey = encryption
      .encryptString(trimmedApiKey)
      .toString("base64")
    updateProviderEntry(provider, (entry) => ({ ...entry, encryptedApiKey }))
  }

  /** 保存した API キーを消す */
  function clearApiKey(provider: GradingProviderId): void {
    updateProviderEntry(provider, (entry) => ({
      ...entry,
      encryptedApiKey: null,
    }))
  }

  /** 同意を記録する（日時はここで付ける） */
  function recordConsent(
    provider: GradingProviderId,
    consent: Omit<ProviderConsent, "consentedAt">
  ): ProviderConsent {
    if (
      !isNonEmptyString(consent.userId) ||
      !isNonEmptyString(consent.consentVersion)
    ) {
      throw new ProviderCredentialError(
        "invalid_settings",
        "同意の記録には利用者 id と同意文の版が要ります"
      )
    }
    const recordedConsent: ProviderConsent = {
      userId: consent.userId,
      consentVersion: consent.consentVersion,
      consentedAt: now().toISOString(),
    }
    updateProviderEntry(provider, (entry) => ({
      ...entry,
      consent: recordedConsent,
    }))
    return recordedConsent
  }

  /** 同意を取り消す。保存した API キーも一緒に消す（設計 §9-1 の 8） */
  function revokeConsent(provider: GradingProviderId): void {
    updateProviderEntry(provider, () => createEmptyEntry())
  }

  /**
   * **main の中で事業者のクライアントを作るためだけに使う。IPC へ返してはならない。**
   *
   * 同意していない・キーが無いときは null。
   *
   * @throws {ProviderCredentialError} 暗号化できない環境・復号に失敗したとき
   */
  function readApiKeyForMainProcessOnly(
    provider: GradingProviderId
  ): string | null {
    const entry = loadFile().providers[provider]
    if (entry.consent === null || entry.encryptedApiKey === null) return null
    if (!encryption.isEncryptionAvailable()) {
      throw new ProviderCredentialError(
        "encryption_unavailable",
        "この環境では API キーを復号できません"
      )
    }
    try {
      return encryption.decryptString(
        Buffer.from(entry.encryptedApiKey, "base64")
      )
    } catch (error) {
      throw new ProviderCredentialError(
        "decryption_failed",
        "保存した API キーを復号できませんでした。キーを設定し直してください",
        { cause: error }
      )
    }
  }

  /** 機密でない既定値 */
  function getSettings(): AiGradingSettings {
    return loadFile().settings
  }

  /**
   * 既定値を変える（渡した項目だけ）
   *
   * @throws {ProviderCredentialError} 値が正しくないとき（何も変えない）
   */
  function updateSettings(
    update: Partial<AiGradingSettings>
  ): AiGradingSettings {
    assertValidSettingsUpdate(update)
    const file = loadFile()
    const current = file.settings
    // 項目を名指しで組む（undefined を渡された項目で上書きしない・知らない項目を保存しない）
    const settings: AiGradingSettings = {
      defaultProvider: update.defaultProvider ?? current.defaultProvider,
      defaultModels: update.defaultModels
        ? {
            anthropic: update.defaultModels.anthropic,
            openai: update.defaultModels.openai,
          }
        : current.defaultModels,
      defaultEffort: update.defaultEffort ?? current.defaultEffort,
      defaultMode: update.defaultMode ?? current.defaultMode,
      concurrency: update.concurrency ?? current.concurrency,
      budgetWarningUsd:
        update.budgetWarningUsd !== undefined
          ? update.budgetWarningUsd
          : current.budgetWarningUsd,
      openaiCompatibleBaseUrl:
        update.openaiCompatibleBaseUrl !== undefined
          ? update.openaiCompatibleBaseUrl
          : current.openaiCompatibleBaseUrl,
      anthropicPricingSourceUrl:
        update.anthropicPricingSourceUrl ?? current.anthropicPricingSourceUrl,
    }
    saveFile({ ...file, settings })
    return settings
  }

  /** 事業者ごとの、取得しておいたモデルの一覧 */
  function getModelCatalogs(): ProviderModelCatalogs {
    return loadFile().modelCatalogs
  }

  /**
   * 事業者から取得したモデルの一覧を保存する（前の一覧は置き換える）。日時はここで付ける。
   * 形の崩れた項目は保存しない（読むときに一覧ごと捨てられるため）
   */
  function saveModelCatalog(
    provider: GradingProviderId,
    models: readonly ProviderModelInfo[]
  ): ProviderModelCatalog {
    const catalog: ProviderModelCatalog = {
      fetchedAt: now().toISOString(),
      // 項目を名指しで組む（事業者の SDK が返した余計な項目を書き込まない）
      models: models.flatMap((model) => {
        const modelInfo = toModelInfo(model)
        return modelInfo ? [modelInfo] : []
      }),
    }
    const file = loadFile()
    saveFile({
      ...file,
      modelCatalogs: { ...file.modelCatalogs, [provider]: catalog },
    })
    return catalog
  }

  /** 利用者が入れた単価 */
  function getPricing(): AiPricing {
    return loadFile().pricing
  }

  function savePricing(pricing: AiPricing): AiPricing {
    saveFile({ ...loadFile(), pricing })
    return pricing
  }

  /**
   * モデルの単価を入れる（同じ事業者・モデルの行があれば置き換える）。
   * 「ページから読み込む」の下書きを保存するときは何行も一度に入れる
   *
   * @throws {ProviderCredentialError} 1行でも値が正しくないとき（何も変えない）
   */
  function setModelPrices(modelPrices: readonly AiModelPrice[]): AiPricing {
    const validPrices = modelPrices.map(toModelPrice)
    if (validPrices.some((validPrice) => validPrice === null)) {
      throw new ProviderCredentialError(
        "invalid_settings",
        "単価の値が正しくありません（モデルの id と、0 以上の数が5つ要ります）"
      )
    }
    const pricing = getPricing()
    const priceByKey = new Map(
      pricing.modelPrices.map((storedPrice) => [
        modelPriceKey(storedPrice.provider, storedPrice.model),
        storedPrice,
      ])
    )
    validPrices.forEach((validPrice) => {
      if (validPrice) {
        priceByKey.set(
          modelPriceKey(validPrice.provider, validPrice.model),
          validPrice
        )
      }
    })
    return savePricing({ ...pricing, modelPrices: [...priceByKey.values()] })
  }

  /** モデル1つの単価を消す（無ければ何もしない） */
  function removeModelPrice(
    provider: GradingProviderId,
    model: string
  ): AiPricing {
    const pricing = getPricing()
    const key = modelPriceKey(provider, model)
    return savePricing({
      ...pricing,
      modelPrices: pricing.modelPrices.filter(
        (storedPrice) =>
          modelPriceKey(storedPrice.provider, storedPrice.model) !== key
      ),
    })
  }

  /**
   * 事業者のバッチの単価が通常の何 % かを入れる（null で未設定に戻す）
   *
   * @throws {ProviderCredentialError} 0〜100 の数でないとき（何も変えない）
   */
  function setBatchPricePercent(
    provider: GradingProviderId,
    percent: number | null
  ): AiPricing {
    if (!isGradingProviderId(provider) || !isValidBatchPricePercent(percent)) {
      throw new ProviderCredentialError(
        "invalid_settings",
        "バッチの割合は 0〜100 の数にしてください"
      )
    }
    const pricing = getPricing()
    return savePricing({
      ...pricing,
      batchPricePercents: {
        ...pricing.batchPricePercents,
        [provider]: percent,
      },
    })
  }

  return {
    getProviderStatus,
    getProviderStatuses,
    setApiKey,
    clearApiKey,
    recordConsent,
    revokeConsent,
    readApiKeyForMainProcessOnly,
    getSettings,
    updateSettings,
    getModelCatalogs,
    saveModelCatalog,
    getPricing,
    setModelPrices,
    removeModelPrice,
    setBatchPricePercent,
  }
}

let appCredentialStore: ReturnType<
  typeof createProviderCredentialStore
> | null = null

/** アプリで使う保存の口（`userData/ai-providers.json` と Electron の safeStorage） */
export function getProviderCredentialStore() {
  if (!appCredentialStore) {
    appCredentialStore = createProviderCredentialStore({
      configFilePath: path.join(app.getPath("userData"), "ai-providers.json"),
      encryption: safeStorage,
    })
  }
  return appCredentialStore
}
