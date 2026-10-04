/**
 * 保存した API キーで事業者へつながるかを試す（設定画面の「接続テスト」）。
 *
 * キーは main の中で復号して事業者のクライアントを作るのに使うだけで、結果には含めない。
 * 失敗は投げずに種類へ分けて返す（つながらないのは予期される結果であって、IPC の失敗ではない）。
 */

import type { createProviderCredentialStore } from "./providerCredentialStore"
import { ProviderCredentialError } from "./providerCredentialStore"
import type { createGradingProvider } from "./providers/createGradingProvider"
import { GradingProviderError } from "./providers/providerShared"
import type {
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

/** 事業者の失敗の種類を、接続テストの結果の種類へ畳む */
function toOutcome(kind: ProviderErrorKind): ProviderConnectionTestOutcome {
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

export async function testProviderConnection(
  provider: GradingProviderId,
  dependencies: ProviderConnectionTestDependencies
): Promise<ProviderConnectionTestResult> {
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
    await gradingProvider.testConnection()
    return { outcome: "ok", message: "" }
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
