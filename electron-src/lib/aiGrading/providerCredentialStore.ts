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
import * as path from "path"

import type { AiGradingRunMode } from "@/types/aiGrading.types"

import { createJsonFileStore } from "../jsonFileStore"
import {
  type AiProvidersFile,
  createDefaultFile,
  createEmptyEntry,
  isNonEmptyString,
  isValidBatchPricePercent,
  listInvalidSettingsFields,
  modelPriceKey,
  type StoredProviderEntry,
  toAiProvidersFile,
  toModelInfo,
  toModelPrice,
} from "./aiProvidersFile"
import type {
  GradingEffort,
  GradingProviderId,
  ProviderModelInfo,
} from "./providers/types"
import { GRADING_PROVIDER_IDS, isGradingProviderId } from "./providers/types"

/** 同意の記録。その端末で、その利用者が、その版の同意文に同意した */
export interface ProviderConsent {
  userId: string
  consentVersion: string
  /** ISO 8601 */
  consentedAt: string
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
  /** 同じく OpenAI の料金のページ（https だけ） */
  openaiPricingSourceUrl: string
  /**
   * 新しく作るプロンプトの「朱書きの指示」（`AiPrompt.annotationInstruction`）に最初から入れる文言。
   * 空なら空欄から始まる。既存のプロンプトには触れない（入れるのは renderer の作成画面）
   */
  defaultAnnotationInstruction: string
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

/** 事業者ごとの状態（IPC へ出してよい形。キーそのものは含めない） */
export interface ProviderStatus {
  provider: GradingProviderId
  hasApiKey: boolean
  isEncryptionAvailable: boolean
  consent: ProviderConsent | null
}

/** 保存・読み出しの失敗の種類 */
type ProviderCredentialErrorCode =
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

/** 設定の変更を確かめる。正しくない値が1つでもあれば全体を拒否する */
function assertValidSettingsUpdate(update: Partial<AiGradingSettings>): void {
  const problems = listInvalidSettingsFields(update)
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

  /**
   * ファイルは起動時に1回だけ読み（`load`）、以後はメモリの写しを正とする。書き込みは
   * 1件ずつ「読んで、直して、書く」（`jsonFileStore.ts`）。API キーを含むので、他の
   * 利用者に読ませない権限で書く
   */
  const fileStore = createJsonFileStore<AiProvidersFile>({
    filePath: configFilePath,
    parse: toAiProvidersFile,
    createDefault: createDefaultFile,
    fileMode: 0o600,
  })
  const loadFile = fileStore.read

  async function updateProviderEntry(
    provider: GradingProviderId,
    update: (entry: StoredProviderEntry) => StoredProviderEntry
  ): Promise<void> {
    await fileStore.update((file) => ({
      ...file,
      providers: {
        ...file.providers,
        [provider]: update(file.providers[provider]),
      },
    }))
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
  async function setApiKey(
    provider: GradingProviderId,
    apiKey: string
  ): Promise<void> {
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
    const encryptedApiKey = encryption
      .encryptString(trimmedApiKey)
      .toString("base64")
    // 同意の確認は書き込みの列の中で行う（確かめてから書くまでの間に取り消されない）
    await updateProviderEntry(provider, (entry) => {
      if (entry.consent === null) {
        throw new ProviderCredentialError(
          "consent_required",
          "同意していない事業者のキーは保存できません"
        )
      }
      return { ...entry, encryptedApiKey }
    })
  }

  /** 保存した API キーを消す */
  async function clearApiKey(provider: GradingProviderId): Promise<void> {
    await updateProviderEntry(provider, (entry) => ({
      ...entry,
      encryptedApiKey: null,
    }))
  }

  /**
   * 同意を記録する（日時はここで付ける）。別の利用者が同意し直すときは、前の利用者の
   * キーを消す
   */
  async function recordConsent(
    provider: GradingProviderId,
    consent: Omit<ProviderConsent, "consentedAt">
  ): Promise<ProviderConsent> {
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
    await updateProviderEntry(provider, (entry) => {
      // 別の利用者が同意し直すときは、前の利用者のキーを引き継がない
      // （キーは利用者が自分で事業者と契約して用意するもの。費用はその契約に掛かる）
      const isAnotherUser =
        entry.consent !== null &&
        entry.consent.userId !== recordedConsent.userId
      return {
        ...entry,
        encryptedApiKey: isAnotherUser ? null : entry.encryptedApiKey,
        consent: recordedConsent,
      }
    })
    return recordedConsent
  }

  /** 同意を取り消す。保存した API キーも一緒に消す（設計 §10-1 の 9） */
  async function revokeConsent(provider: GradingProviderId): Promise<void> {
    await updateProviderEntry(provider, () => createEmptyEntry())
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
  async function updateSettings(
    update: Partial<AiGradingSettings>
  ): Promise<AiGradingSettings> {
    assertValidSettingsUpdate(update)
    const file = await fileStore.update((currentFile) => ({
      ...currentFile,
      settings: mergeSettings(currentFile.settings, update),
    }))
    return file.settings
  }

  /** 既定値に、渡した項目だけを重ねる */
  function mergeSettings(
    current: AiGradingSettings,
    update: Partial<AiGradingSettings>
  ): AiGradingSettings {
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
      openaiPricingSourceUrl:
        update.openaiPricingSourceUrl ?? current.openaiPricingSourceUrl,
      defaultAnnotationInstruction:
        update.defaultAnnotationInstruction ??
        current.defaultAnnotationInstruction,
    }
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
  async function saveModelCatalog(
    provider: GradingProviderId,
    models: readonly ProviderModelInfo[]
  ): Promise<ProviderModelCatalog> {
    const catalog: ProviderModelCatalog = {
      fetchedAt: now().toISOString(),
      // 項目を名指しで組む（事業者の SDK が返した余計な項目を書き込まない）
      models: models.flatMap((model) => {
        const modelInfo = toModelInfo(model)
        return modelInfo ? [modelInfo] : []
      }),
    }
    await fileStore.update((file) => ({
      ...file,
      modelCatalogs: { ...file.modelCatalogs, [provider]: catalog },
    }))
    return catalog
  }

  /** 利用者が入れた単価 */
  function getPricing(): AiPricing {
    return loadFile().pricing
  }

  /** 今の単価から次の単価を作って書く */
  async function updatePricing(
    change: (pricing: AiPricing) => AiPricing
  ): Promise<AiPricing> {
    const file = await fileStore.update((currentFile) => ({
      ...currentFile,
      pricing: change(currentFile.pricing),
    }))
    return file.pricing
  }

  /**
   * モデルの単価を入れる（同じ事業者・モデルの行があれば置き換える）。
   * 「ページから読み込む」の下書きを保存するときは何行も一度に入れる
   *
   * @throws {ProviderCredentialError} 1行でも値が正しくないとき（何も変えない）
   */
  async function setModelPrices(
    modelPrices: readonly AiModelPrice[]
  ): Promise<AiPricing> {
    const validPrices = modelPrices.map(toModelPrice)
    if (validPrices.some((validPrice) => validPrice === null)) {
      throw new ProviderCredentialError(
        "invalid_settings",
        "単価の値が正しくありません（モデルの id と、0 以上の数が5つ要ります）"
      )
    }
    return updatePricing((pricing) => {
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
      return { ...pricing, modelPrices: [...priceByKey.values()] }
    })
  }

  /** モデル1つの単価を消す（無ければ何もしない） */
  async function removeModelPrice(
    provider: GradingProviderId,
    model: string
  ): Promise<AiPricing> {
    const key = modelPriceKey(provider, model)
    return updatePricing((pricing) => ({
      ...pricing,
      modelPrices: pricing.modelPrices.filter(
        (storedPrice) =>
          modelPriceKey(storedPrice.provider, storedPrice.model) !== key
      ),
    }))
  }

  /**
   * 事業者のバッチの単価が通常の何 % かを入れる（null で未設定に戻す）
   *
   * @throws {ProviderCredentialError} 0〜100 の数でないとき（何も変えない）
   */
  async function setBatchPricePercent(
    provider: GradingProviderId,
    percent: number | null
  ): Promise<AiPricing> {
    if (!isGradingProviderId(provider) || !isValidBatchPricePercent(percent)) {
      throw new ProviderCredentialError(
        "invalid_settings",
        "バッチの割合は 0〜100 の数にしてください"
      )
    }
    return updatePricing((pricing) => ({
      ...pricing,
      batchPricePercents: {
        ...pricing.batchPricePercents,
        [provider]: percent,
      },
    }))
  }

  return {
    /** 起動時に1回呼ぶ（IPC を受け付ける前） */
    load: fileStore.load,
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
