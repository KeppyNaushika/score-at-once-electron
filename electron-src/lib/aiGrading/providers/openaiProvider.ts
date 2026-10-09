/**
 * OpenAI の事業者実装（設計 §6-3）。
 *
 * - Responses API。構造化出力は `text.format` の json_schema（strict）、推論の手間は `reasoning.effort`
 * - キャッシュは事業者が自動で効かせる。固定部から求めた `prompt_cache_key` を付け、
 *   同じ固定部の依頼が同じ所へ振り分けられるようにする
 * - `store: false` を付け、応答を事業者側に保存させない
 * - バッチは JSONL を files へ上げ、`/v1/responses` のバッチを作る
 */

import * as crypto from "crypto"
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
  toFile,
  UnprocessableEntityError,
} from "openai"
import type { Batch, BatchCreateParams } from "openai/resources/batches"
import type { FileCreateParams, FileObject } from "openai/resources/files"
import type { Model } from "openai/resources/models"
import type {
  Response as OpenAiResponse,
  ResponseCreateParamsNonStreaming,
  ResponseInputContent,
  ResponseUsage,
} from "openai/resources/responses/responses"

import {
  assertValidBatchRequests,
  createCompletedResponse,
  createErrorResponse,
  GradingProviderError,
  parseJsonText,
  ZERO_USAGE,
} from "./providerShared"
import type {
  GradingProvider,
  GradingRequest,
  JsonObject,
  JsonValue,
  PromptPart,
  ProviderBatchResult,
  ProviderBatchStatus,
  ProviderErrorKind,
  ProviderGradingResponse,
  ProviderModelInfo,
  ProviderUsage,
} from "./types"

/**
 * この実装が使う OpenAI クライアントの部分。実物の `OpenAI` をそのまま渡せる。
 * テストでは偽のクライアントを渡す
 */
export interface OpenAiGradingClient {
  responses: {
    create(
      params: ResponseCreateParamsNonStreaming,
      options?: { signal?: AbortSignal }
    ): PromiseLike<OpenAiResponse>
  }
  files: {
    create(params: FileCreateParams): PromiseLike<FileObject>
    content(fileId: string): PromiseLike<Response>
    delete(fileId: string): PromiseLike<unknown>
  }
  batches: {
    create(params: BatchCreateParams): PromiseLike<Batch>
    retrieve(batchId: string): PromiseLike<Batch>
    cancel(batchId: string): PromiseLike<Batch>
  }
  models: {
    /** 待てば最初のページ、for await で回せば全ページのモデルが順に来る（SDK の PagePromise） */
    list(): PromiseLike<unknown> & AsyncIterable<Model>
  }
}

/**
 * SDK のモデルの情報を、事業者に依存しない形にする。
 * OpenAI の一覧は名前も能力も返さないので、名前は id、能力は null にする
 */
export function toOpenAiModelInfo(model: Model): ProviderModelInfo {
  return {
    id: model.id,
    displayName: model.id,
    createdAt:
      Number.isFinite(model.created) && model.created > 0
        ? new Date(model.created * 1000).toISOString()
        : null,
    supportsAdaptiveThinking: null,
  }
}

/** 公開日時の新しい順（日時の分からないものは後ろ）。同じなら id の順 */
function compareByCreatedAtDescending(
  left: ProviderModelInfo,
  right: ProviderModelInfo
): number {
  if (left.createdAt !== right.createdAt) {
    if (left.createdAt === null) return 1
    if (right.createdAt === null) return -1
    return left.createdAt < right.createdAt ? 1 : -1
  }
  return left.id.localeCompare(right.id)
}

/** バッチの1行が叩く API */
const BATCH_ENDPOINT = "/v1/responses"

function toInputContent(part: PromptPart): ResponseInputContent {
  if (part.kind === "text") return { type: "input_text", text: part.text }
  return {
    type: "input_image",
    // 送る画像は切り出したままの原寸。縮められないよう high を指定する（設計 §7）
    detail: "high",
    image_url: `data:${part.mediaType};base64,${part.base64Data}`,
  }
}

/**
 * 固定部から求めたキャッシュの振り分けキー。同じ固定部なら同じ値になる
 * （答案の画像は含めない）
 */
function getPromptCacheKey(request: GradingRequest): string {
  const fixedPrefix = JSON.stringify([
    request.model,
    request.systemText,
    request.fixedParts,
    request.outputSchema,
  ])
  return crypto
    .createHash("sha256")
    .update(fixedPrefix)
    .digest("hex")
    .slice(0, 32)
}

/** 依頼を Responses API の引数にする。答案の画像は固定部の後ろに置く */
function buildOpenAiResponseParams(
  request: GradingRequest
): ResponseCreateParamsNonStreaming {
  return {
    model: request.model,
    max_output_tokens: request.maxOutputTokens,
    instructions: request.systemText,
    input: [
      {
        role: "user",
        content: [
          ...request.fixedParts.map(toInputContent),
          ...request.variableParts.map(toInputContent),
        ],
      },
    ],
    reasoning: { effort: request.effort },
    text: {
      format: {
        type: "json_schema",
        // 構造化出力のスキーマ名（OpenAI は名前を必須にする）。段ごとに違う
        name: request.outputSchemaName,
        schema: request.outputSchema,
        strict: true,
      },
    },
    prompt_cache_key: getPromptCacheKey(request),
    store: false,
  }
}

/**
 * バッチに上げるファイル（答案画像を含む）の寿命。取り込めば `cleanupBatch` がその場で
 * 消すが、アプリが長く起動されず取り込めなかったときも事業者側に残り続けないよう、
 * 期限を付けて自動で消させる（期限を付けないと、batch 用のファイルは既定で 30 日残る）。
 * 送信用は処理の期限（24h）に余裕を見た 2 日、結果は取り込みを待つ 7 日
 */
const BATCH_INPUT_FILE_LIFETIME_SECONDS = 2 * 24 * 60 * 60
const BATCH_OUTPUT_FILE_LIFETIME_SECONDS = 7 * 24 * 60 * 60

/**
 * 応答から、揃えた形を作るのに要るものだけを抜き出したもの。
 * SDK の応答（その場の採点）とバッチの JSONL（型の無い JSON）の両方から作る
 */
interface OpenAiResponseOutline {
  status: string | null
  /** 出力されたテキスト（出力順） */
  outputTexts: string[]
  refusal: string | null
  incompleteReason: string | null
  errorCode: string | null
  errorMessage: string | null
  usage: ProviderUsage
}

/**
 * OpenAI の使用量を揃える。OpenAI の input_tokens はキャッシュの読み書きを含む内訳なので、
 * 引き算して重ならないようにする
 */
function toProviderUsage(usage: {
  inputTokens: number
  outputTokens: number
  cachedTokens: number
  cacheWriteTokens: number
}): ProviderUsage {
  return {
    inputTokens: Math.max(
      0,
      usage.inputTokens - usage.cachedTokens - usage.cacheWriteTokens
    ),
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cachedTokens,
    cacheWriteTokens: usage.cacheWriteTokens,
  }
}

function toUsageFromSdk(usage: ResponseUsage | undefined): ProviderUsage {
  if (!usage) return ZERO_USAGE
  return toProviderUsage({
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cachedTokens: usage.input_tokens_details.cached_tokens,
    cacheWriteTokens: usage.input_tokens_details.cache_write_tokens ?? 0,
  })
}

function toOutlineFromSdk(response: OpenAiResponse): OpenAiResponseOutline {
  const messageContents = response.output.flatMap((item) =>
    item.type === "message" ? item.content : []
  )
  const outputTexts = messageContents.flatMap((content) =>
    content.type === "output_text" ? [content.text] : []
  )
  const refusals = messageContents.flatMap((content) =>
    content.type === "refusal" ? [content.refusal] : []
  )
  return {
    status: response.status ?? null,
    outputTexts,
    refusal: refusals.length > 0 ? refusals.join("\n") : null,
    incompleteReason: response.incomplete_details?.reason ?? null,
    errorCode: response.error?.code ?? null,
    errorMessage: response.error?.message ?? null,
    usage: toUsageFromSdk(response.usage),
  }
}

function toErrorKindFromCode(errorCode: string | null): ProviderErrorKind {
  if (errorCode === "rate_limit_exceeded") return "rate_limit"
  if (errorCode === "server_error") return "server"
  if (errorCode === null) return "unknown"
  return "bad_request"
}

/** 抜き出した応答を揃えた形にする。状態を見てから中身を読む */
function toGradingResponseFromOutline(
  outline: OpenAiResponseOutline
): ProviderGradingResponse {
  const rawText = outline.outputTexts.at(-1) ?? ""
  if (outline.errorMessage !== null || outline.status === "failed") {
    return {
      ...createErrorResponse(
        toErrorKindFromCode(outline.errorCode),
        outline.errorMessage ?? "応答の生成に失敗しました",
        outline.usage
      ),
      rawText,
    }
  }
  if (
    outline.refusal !== null ||
    outline.incompleteReason === "content_filter"
  ) {
    return {
      parsedJson: null,
      rawText,
      usage: outline.usage,
      stop: "refused",
      errorMessage: `モデルが応答を拒否しました: ${outline.refusal ?? "content_filter"}`,
      errorKind: null,
    }
  }
  if (outline.incompleteReason === "max_output_tokens") {
    return {
      parsedJson: null,
      rawText,
      usage: outline.usage,
      stop: "max_tokens",
      errorMessage: "出力が上限で打ち切られました（max_output_tokens）",
      errorKind: null,
    }
  }
  if (outline.status === "cancelled") {
    return createErrorResponse(
      "canceled",
      "応答が取り消されました",
      outline.usage
    )
  }
  if (outline.status !== "completed") {
    return {
      ...createErrorResponse(
        "invalid_output",
        `想定していない状態です（${outline.status ?? "null"}${outline.incompleteReason ? `: ${outline.incompleteReason}` : ""}）`,
        outline.usage
      ),
      rawText,
    }
  }
  return createCompletedResponse(rawText, outline.usage)
}

/** Responses API の応答を揃えた形にする */
function toOpenAiGradingResponse(
  response: OpenAiResponse
): ProviderGradingResponse {
  return toGradingResponseFromOutline(toOutlineFromSdk(response))
}

// ---- バッチの JSONL（SDK に型が無いので、JSON を確かめながら読む） ----

function getObject(value: JsonValue | undefined): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null
}

function getArray(value: JsonValue | undefined): JsonValue[] {
  return Array.isArray(value) ? value : []
}

function getString(value: JsonValue | undefined): string | null {
  return typeof value === "string" ? value : null
}

function getNumber(value: JsonValue | undefined): number {
  return typeof value === "number" ? value : 0
}

function toOutlineFromJson(body: JsonObject): OpenAiResponseOutline {
  const messageContents = getArray(body.output)
    .map(getObject)
    .flatMap((item) => (item?.type === "message" ? getArray(item.content) : []))
    .map(getObject)
  const outputTexts = messageContents.flatMap((content) => {
    const text = getString(content?.text)
    return content?.type === "output_text" && text !== null ? [text] : []
  })
  const refusals = messageContents.flatMap((content) => {
    const refusal = getString(content?.refusal)
    return content?.type === "refusal" && refusal !== null ? [refusal] : []
  })
  const usage = getObject(body.usage)
  const inputDetails = getObject(usage?.input_tokens_details)
  const error = getObject(body.error)
  return {
    status: getString(body.status),
    outputTexts,
    refusal: refusals.length > 0 ? refusals.join("\n") : null,
    incompleteReason: getString(getObject(body.incomplete_details)?.reason),
    errorCode: getString(error?.code),
    errorMessage: error ? (getString(error.message) ?? "不明なエラー") : null,
    usage: toProviderUsage({
      inputTokens: getNumber(usage?.input_tokens),
      outputTokens: getNumber(usage?.output_tokens),
      cachedTokens: getNumber(inputDetails?.cached_tokens),
      cacheWriteTokens: getNumber(inputDetails?.cache_write_tokens),
    }),
  }
}

function toErrorKindFromHttpStatus(statusCode: number): ProviderErrorKind {
  if (statusCode === 401) return "authentication"
  if (statusCode === 403) return "permission"
  if (statusCode === 429) return "rate_limit"
  if (statusCode >= 500) return "server"
  if (statusCode >= 400) return "bad_request"
  return "unknown"
}

/**
 * バッチの出力（または失敗）ファイルの1行を読む。custom_id が無い行は対応付けられないので null
 */
function parseOpenAiBatchLine(line: string): ProviderBatchResult | null {
  const record = getObject(parseJsonText(line))
  if (!record) return null
  const customId = getString(record.custom_id)
  if (customId === null) return null

  const lineError = getObject(record.error)
  if (lineError) {
    const errorCode = getString(lineError.code)
    const errorMessage = getString(lineError.message) ?? "不明なエラー"
    const errorKind: ProviderErrorKind =
      errorCode === "batch_expired"
        ? "expired"
        : errorCode === "batch_cancelled"
          ? "canceled"
          : toErrorKindFromCode(errorCode)
    return { customId, response: createErrorResponse(errorKind, errorMessage) }
  }

  const response = getObject(record.response)
  const body = getObject(response?.body)
  if (!response || !body) {
    return {
      customId,
      response: createErrorResponse("unknown", "応答がありません"),
    }
  }
  const statusCode = getNumber(response.status_code)
  if (statusCode !== 200) {
    const bodyError = getObject(body.error)
    return {
      customId,
      response: createErrorResponse(
        toErrorKindFromHttpStatus(statusCode),
        getString(bodyError?.message) ?? `HTTP ${statusCode}`
      ),
    }
  }
  return {
    customId,
    response: toGradingResponseFromOutline(toOutlineFromJson(body)),
  }
}

/** バッチの状態を揃える */
function toProviderBatchStatus(status: Batch["status"]): ProviderBatchStatus {
  switch (status) {
    case "validating":
    case "in_progress":
    case "finalizing":
      return "in_progress"
    case "cancelling":
      return "canceling"
    case "completed":
    case "expired":
    case "cancelled":
      return "ended"
    case "failed":
      return "failed"
  }
}

function toErrorKind(error: unknown): ProviderErrorKind {
  // 継承関係があるので、子のクラスから順に調べる
  if (error instanceof APIUserAbortError) return "aborted"
  if (error instanceof APIConnectionTimeoutError) return "timeout"
  if (error instanceof APIConnectionError) return "connection"
  if (error instanceof AuthenticationError) return "authentication"
  if (error instanceof PermissionDeniedError) return "permission"
  if (error instanceof RateLimitError) return "rate_limit"
  if (
    error instanceof BadRequestError ||
    error instanceof NotFoundError ||
    error instanceof UnprocessableEntityError
  ) {
    return "bad_request"
  }
  if (error instanceof InternalServerError) return "server"
  if (error instanceof APIError && (error.status ?? 0) >= 500) return "server"
  return "unknown"
}

/** SDK が投げた失敗を `GradingProviderError` にする */
function toOpenAiProviderError(error: unknown): GradingProviderError {
  if (error instanceof GradingProviderError) return error
  const message = error instanceof Error ? error.message : String(error)
  return new GradingProviderError(toErrorKind(error), message, { cause: error })
}

async function callOpenAi<T>(call: () => PromiseLike<T>): Promise<T> {
  try {
    return await call()
  } catch (error) {
    throw toOpenAiProviderError(error)
  }
}

/**
 * OpenAI の事業者を作る。
 *
 * @param client - `new OpenAI({ apiKey, fetch })` で作ったクライアント（テストでは偽物）
 */
export function createOpenAiProvider(
  client: OpenAiGradingClient
): GradingProvider {
  async function readFileLines(fileId: string): Promise<string[]> {
    const content = await callOpenAi(() => client.files.content(fileId))
    const text = await content.text()
    return text.split("\n").filter((line) => line.trim() !== "")
  }

  return {
    id: "openai",
    capabilities: {
      batch: true,
      promptCache: "automatic",
      structuredOutput: "json_schema",
    },

    async grade(request, signal) {
      const response = await callOpenAi(() =>
        client.responses.create(buildOpenAiResponseParams(request), { signal })
      )
      return toOpenAiGradingResponse(response)
    },

    async submitBatch(requests) {
      assertValidBatchRequests(requests)
      const jsonl = requests
        .map((request) =>
          JSON.stringify({
            custom_id: request.customId,
            method: "POST",
            url: BATCH_ENDPOINT,
            body: buildOpenAiResponseParams(request),
          })
        )
        .join("\n")
      const file = await toFile(Buffer.from(jsonl, "utf-8"), "grading.jsonl", {
        type: "application/jsonl",
      })
      const uploadedFile = await callOpenAi(() =>
        client.files.create({
          file,
          purpose: "batch",
          expires_after: {
            anchor: "created_at",
            seconds: BATCH_INPUT_FILE_LIFETIME_SECONDS,
          },
        })
      )
      const batch = await callOpenAi(() =>
        client.batches.create({
          input_file_id: uploadedFile.id,
          endpoint: BATCH_ENDPOINT,
          completion_window: "24h",
          output_expires_after: {
            anchor: "created_at",
            seconds: BATCH_OUTPUT_FILE_LIFETIME_SECONDS,
          },
        })
      )
      return { externalBatchId: batch.id }
    },

    async getBatchStatus(externalBatchId) {
      const batch = await callOpenAi(() =>
        client.batches.retrieve(externalBatchId)
      )
      return toProviderBatchStatus(batch.status)
    },

    async *readBatchResults(externalBatchId) {
      const batch = await callOpenAi(() =>
        client.batches.retrieve(externalBatchId)
      )
      // 成功した行は output、失敗・期限切れの行は error のファイルに入る
      const fileIds = [batch.output_file_id, batch.error_file_id].filter(
        (fileId): fileId is string => typeof fileId === "string"
      )
      for (const fileId of fileIds) {
        const lines = await readFileLines(fileId)
        for (const line of lines) {
          const result = parseOpenAiBatchLine(line)
          if (result) {
            yield result
          } else {
            console.warn("[aiGrading] 読めないバッチ結果の行を飛ばしました")
          }
        }
      }
    },

    async cancelBatch(externalBatchId) {
      await callOpenAi(() => client.batches.cancel(externalBatchId))
    },

    async cleanupBatch(externalBatchId) {
      const batch = await callOpenAi(() =>
        client.batches.retrieve(externalBatchId)
      )
      // 入力（答案の画像を含む JSONL）・出力・失敗のファイルを消す
      const fileIds = [
        batch.input_file_id,
        batch.output_file_id,
        batch.error_file_id,
      ].filter(
        (fileId): fileId is string =>
          typeof fileId === "string" && fileId !== ""
      )
      for (const fileId of fileIds) {
        await callOpenAi(() => client.files.delete(fileId))
      }
    },

    async testConnection() {
      await callOpenAi(() => client.models.list())
    },

    async listModels() {
      try {
        const models: ProviderModelInfo[] = []
        for await (const model of client.models.list()) {
          models.push(toOpenAiModelInfo(model))
        }
        // OpenAI の一覧は並び順を約束しないので、新しい順に並べ直す
        return models.sort(compareByCreatedAtDescending)
      } catch (error) {
        throw toOpenAiProviderError(error)
      }
    },
  }
}
