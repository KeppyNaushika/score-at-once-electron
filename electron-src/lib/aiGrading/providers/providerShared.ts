/**
 * 事業者の実装どうしで共有する、SDK に依存しない部品。
 */

import type {
  GradingRequest,
  JsonValue,
  ProviderErrorKind,
  ProviderGradingResponse,
  ProviderUsage,
} from "./types"

/**
 * 事業者への呼び出しが失敗したことを表す。`kind` で失敗の種類を分ける。
 *
 * メッセージには SDK のエラー文をそのまま使う（SDK は API キーを文中に含めない）。
 */
export class GradingProviderError extends Error {
  readonly kind: ProviderErrorKind

  constructor(
    kind: ProviderErrorKind,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = "GradingProviderError"
    this.kind = kind
  }
}

/** バッチの custom_id に使える文字列（Anthropic の制約。OpenAI もこれに揃える） */
const CUSTOM_ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/

/**
 * バッチへ入れる依頼の customId を確かめる。
 *
 * 形が違うもの・重複は事業者に送る前に止める（結果を依頼へ対応付けられなくなるため）。
 *
 * @throws {GradingProviderError} kind が bad_request
 */
export function assertValidBatchRequests(requests: GradingRequest[]): void {
  if (requests.length === 0) {
    throw new GradingProviderError("bad_request", "バッチに依頼がありません")
  }
  const seenCustomIds = new Set<string>()
  requests.forEach((request) => {
    if (!CUSTOM_ID_PATTERN.test(request.customId)) {
      throw new GradingProviderError(
        "bad_request",
        `customId は英数字・_・- の1〜64字にしてください: ${request.customId}`
      )
    }
    if (seenCustomIds.has(request.customId)) {
      throw new GradingProviderError(
        "bad_request",
        `customId が重複しています: ${request.customId}`
      )
    }
    seenCustomIds.add(request.customId)
  })
}

/** 値が JSON として表せるかどうか（JSON.parse の戻り値を型に載せるため） */
function isJsonValue(candidate: unknown): candidate is JsonValue {
  if (
    candidate === null ||
    typeof candidate === "string" ||
    typeof candidate === "boolean"
  ) {
    return true
  }
  if (typeof candidate === "number") return Number.isFinite(candidate)
  if (Array.isArray(candidate)) return candidate.every(isJsonValue)
  if (typeof candidate === "object") {
    return Object.values(candidate).every(isJsonValue)
  }
  return false
}

/** 文字列を JSON として読む。読めなければ null（文字列の照合はしない） */
export function parseJsonText(text: string): JsonValue | null {
  try {
    const parsed: unknown = JSON.parse(text)
    return isJsonValue(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** 使用量の0 */
export const ZERO_USAGE: ProviderUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
}

/** 応答が届かなかった・使えなかったときの応答（バッチの失敗した1件など） */
export function createErrorResponse(
  errorKind: ProviderErrorKind,
  errorMessage: string,
  usage: ProviderUsage = ZERO_USAGE
): ProviderGradingResponse {
  return {
    parsedJson: null,
    rawText: "",
    usage,
    stop: "error",
    errorMessage,
    errorKind,
  }
}

/**
 * 最後まで出力された応答のテキストを、揃えた形にする。
 * JSON として読めなければ stop を error（invalid_output）にする
 */
export function createCompletedResponse(
  rawText: string,
  usage: ProviderUsage
): ProviderGradingResponse {
  const parsedJson = parseJsonText(rawText)
  if (parsedJson === null) {
    return {
      ...createErrorResponse(
        "invalid_output",
        "出力を JSON として読めませんでした",
        usage
      ),
      rawText,
    }
  }
  return {
    parsedJson,
    rawText,
    usage,
    stop: "completed",
    errorMessage: "",
    errorKind: null,
  }
}
