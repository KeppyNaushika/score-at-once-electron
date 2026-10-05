/**
 * 保存した API キーで事業者へつながるかを試す（設定画面の「接続テスト」）。
 * 同じ手順で、事業者からモデルの一覧を取得して保存する（設定画面の「モデル一覧を取得」）。
 *
 * キーは main の中で復号して事業者のクライアントを作るのに使うだけで、結果には含めない。
 * 失敗は投げずに種類へ分けて返す（つながらないのは予期される結果であって、IPC の失敗ではない）。
 */

import type {
  createProviderCredentialStore,
  ProviderModelCatalog,
} from "./providerCredentialStore"
import { ProviderCredentialError } from "./providerCredentialStore"
import type { createGradingProvider } from "./providers/createGradingProvider"
import { GradingProviderError } from "./providers/providerShared"
import type {
  GradingProvider,
  GradingProviderId,
  ProviderErrorKind,
  ProviderFetch,
} from "./providers/types"

/** 接続テストの結果の種類。画面はこの種類ごとに次の手を示す */
export type ProviderConnectionTestOutcome =
  "ok" | "authentication" | "connection" | "rate_limit" | "unknown"

/** 接続テストの結果。API キーは含めない */
export interface ProviderConnectionTestResult {
  outcome: ProviderConnectionTestOutcome
  /** 失敗の説明。ok なら空文字 */
  message: string
}

interface ProviderConnectionTestDependencies {
  store: Pick<
    ReturnType<typeof createProviderCredentialStore>,
    "readApiKeyForMainProcessOnly"
  >
  createProvider: typeof createGradingProvider
  fetch: ProviderFetch
}

/** モデルの一覧の取得の結果の種類。接続テストの種類に「今の同意が無い」を足したもの */
export type ProviderModelFetchOutcome =
  ProviderConnectionTestOutcome | "consent_required"

/** モデルの一覧の取得の結果。API キーは含めない */
export interface ProviderModelFetchResult {
  outcome: ProviderModelFetchOutcome
  /** 失敗の説明。ok なら空文字 */
  message: string
  /** 取得して保存した一覧。失敗なら null（前に保存した一覧はそのまま残る） */
  catalog: ProviderModelCatalog | null
}

interface ProviderModelFetchDependencies {
  store: Pick<
    ReturnType<typeof createProviderCredentialStore>,
    "getProviderStatus" | "readApiKeyForMainProcessOnly" | "saveModelCatalog"
  >
  createProvider: typeof createGradingProvider
  fetch: ProviderFetch
  /** 今ログインしている利用者。分からなければ null（取得しない） */
  currentUserId: string | null
  /** 今の同意文の版 */
  consentVersion: string
}

/** 保存したキーで事業者を作って呼んだ結果。失敗は種類と説明にしてある */
type StoredProviderCallResult<T> =
  | { outcome: "ok"; value: T }
  | {
      outcome: Exclude<ProviderConnectionTestOutcome, "ok">
      message: string
    }

/** 事業者の失敗の種類を、接続テストの結果の種類へ畳む */
function toOutcome(
  kind: ProviderErrorKind
): Exclude<ProviderConnectionTestOutcome, "ok"> {
  switch (kind) {
    case "authentication":
    case "permission":
      return "authentication"
    case "connection":
    case "timeout":
      return "connection"
    case "rate_limit":
      return "rate_limit"
    default:
      return "unknown"
  }
}

/** 念のため、説明の文からキーを伏せる（SDK はキーを文に含めないが、ここで保証する） */
function redactApiKey(message: string, apiKey: string): string {
  return apiKey === "" ? message : message.split(apiKey).join("***")
}

/**
 * 保存したキーで事業者を作り、`call` を呼ぶ。キーは main の中で復号し、結果には含めない。
 * 失敗は投げずに種類へ分けて返す
 */
async function callWithStoredProvider<T>(
  provider: GradingProviderId,
  dependencies: ProviderConnectionTestDependencies,
  call: (gradingProvider: GradingProvider) => Promise<T>
): Promise<StoredProviderCallResult<T>> {
  let apiKey: string | null
  try {
    apiKey = dependencies.store.readApiKeyForMainProcessOnly(provider)
  } catch (error) {
    if (error instanceof ProviderCredentialError) {
      return { outcome: "unknown", message: error.message }
    }
    throw error
  }
  if (apiKey === null) {
    return {
      outcome: "authentication",
      message: "API キーが設定されていません",
    }
  }

  try {
    const gradingProvider = dependencies.createProvider({
      provider,
      apiKey,
      fetch: dependencies.fetch,
    })
    return { outcome: "ok", value: await call(gradingProvider) }
  } catch (error) {
    if (error instanceof GradingProviderError) {
      return {
        outcome: toOutcome(error.kind),
        message: redactApiKey(error.message, apiKey),
      }
    }
    return {
      outcome: "unknown",
      message:
        error instanceof Error
          ? redactApiKey(error.message, apiKey)
          : "接続を確かめられませんでした",
    }
  }
}

export async function testProviderConnection(
  provider: GradingProviderId,
  dependencies: ProviderConnectionTestDependencies
): Promise<ProviderConnectionTestResult> {
  const result = await callWithStoredProvider(
    provider,
    dependencies,
    (gradingProvider) => gradingProvider.testConnection()
  )
  return result.outcome === "ok" ? { outcome: "ok", message: "" } : result
}

/**
 * 保存したキーで事業者からモデルの一覧を取得し、保存して返す。
 *
 * 今の利用者の今の版の同意があり、キーが保存されているときだけ事業者を呼ぶ
 * （同意が古い・別の利用者の同意なら、事業者へは何も送らない）
 */
export async function fetchProviderModels(
  provider: GradingProviderId,
  dependencies: ProviderModelFetchDependencies
): Promise<ProviderModelFetchResult> {
  const consent = dependencies.store.getProviderStatus(provider).consent
  if (
    consent === null ||
    dependencies.currentUserId === null ||
    consent.userId !== dependencies.currentUserId ||
    consent.consentVersion !== dependencies.consentVersion
  ) {
    return {
      outcome: "consent_required",
      message: "この事業者への今の利用者の同意がありません",
      catalog: null,
    }
  }
  const result = await callWithStoredProvider(
    provider,
    dependencies,
    (gradingProvider) => gradingProvider.listModels()
  )
  if (result.outcome !== "ok") return { ...result, catalog: null }
  return {
    outcome: "ok",
    message: "",
    catalog: dependencies.store.saveModelCatalog(provider, result.value),
  }
}
