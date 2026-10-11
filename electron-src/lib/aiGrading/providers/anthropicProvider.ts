/**
 * Anthropic（Claude）の事業者実装（設計 §6-3）。
 *
 * - adaptive thinking と effort は、対応するモデルにだけ送る（`decideAdaptiveThinking`。
 *   `src/lib/shared/aiGrading/modelFeatures.ts`）。取得したモデルの一覧が能力を言っていれば
 *   それに従い、言っていなければ許可リストで決める。画面の「手間」も同じ判断で選べる・選べないが決まる。
 *   claude-opus-5-5 は思考を止められず、effort の既定が medium なので明示する。
 *   claude-haiku-4-5 はどちらも受け付けない（送ると 400）
 * - `output_config.format`（構造化出力）はどのモデルにも送る
 * - 固定部の最後の1片に `cache_control` を置き、答案の画像はその後ろに置く
 * - バッチは `messages.batches.*`。結果は届いた順に読み、custom_id で依頼へ戻す
 *
 * TODO: リアルタイムの採点にだけ、サーバ側の `fallbacks`（beta）を検討する。バッチには使わない
 */

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
  UnprocessableEntityError,
} from "@anthropic-ai/sdk"
import type {
  BatchCreateParams,
  MessageBatch,
  MessageBatchIndividualResponse,
  MessageBatchResult,
} from "@anthropic-ai/sdk/resources/messages/batches"
import type {
  CacheControlEphemeral,
  ImageBlockParam,
  Message,
  MessageCreateParamsNonStreaming,
  MessageStreamParams,
  TextBlockParam,
  Usage,
} from "@anthropic-ai/sdk/resources/messages/messages"
import type { ModelInfo } from "@anthropic-ai/sdk/resources/models"
import type { ErrorObject } from "@anthropic-ai/sdk/resources/shared"

import { decideAdaptiveThinking } from "@/lib/shared/aiGrading/modelFeatures"

import {
  assertValidBatchRequests,
  createCompletedResponse,
  createErrorResponse,
  GradingProviderError,
} from "./providerShared"
import type {
  GradingProvider,
  GradingRequest,
  PromptPart,
  ProviderBatchStatus,
  ProviderErrorKind,
  ProviderGradingResponse,
  ProviderModelInfo,
  ProviderUsage,
} from "./types"

/**
 * この実装が使う Anthropic クライアントの部分。実物の `Anthropic` をそのまま渡せる。
 * テストでは偽のクライアントを渡す
 */
export interface AnthropicGradingClient {
  messages: {
    /**
     * すぐ返す送り方はストリーミングで受ける。出力の上限が大きい依頼（2段目）は、
     * ストリーミングでないと SDK が「10分を超えうる」として送る前に止めるため
     */
    stream(
      params: MessageStreamParams,
      options?: { signal?: AbortSignal }
    ): { finalMessage(): Promise<Message> }
    batches: {
      create(params: BatchCreateParams): PromiseLike<MessageBatch>
      retrieve(messageBatchId: string): PromiseLike<MessageBatch>
      results(
        messageBatchId: string
      ): PromiseLike<AsyncIterable<MessageBatchIndividualResponse>>
      cancel(messageBatchId: string): PromiseLike<MessageBatch>
      delete(messageBatchId: string): PromiseLike<unknown>
    }
  }
  models: {
    /** 待てば最初のページ、for await で回せば全ページのモデルが順に来る（SDK の PagePromise） */
    list(params: {
      limit: number
    }): PromiseLike<unknown> & AsyncIterable<ModelInfo>
  }
}

/** 事業者の実装を作るときの選択 */
export interface AnthropicProviderOptions {
  /**
   * 取得しておいたモデルの一覧（`listModels` の結果）。adaptive thinking を送るかの判断に使う。
   * 無ければ許可リストだけで決める
   */
  catalogModels?: readonly ProviderModelInfo[]
}

/** モデルの一覧を1ページで読む件数（SDK の上限） */
const MODEL_LIST_PAGE_SIZE = 1000

/** プロンプトキャッシュの寿命。バッチは処理に時間がかかるので 1h にする */
type CacheTtl = "5m" | "1h"

function toContentBlock(part: PromptPart): TextBlockParam | ImageBlockParam {
  if (part.kind === "text") return { type: "text", text: part.text }
  return {
    type: "image",
    source: {
      type: "base64",
      media_type: part.mediaType,
      data: part.base64Data,
    },
  }
}

/**
 * 依頼を Messages API の引数にする。
 *
 * キャッシュの区切りは固定部の最後の1片に置く（固定部が空なら system に置く）。
 * 描画順は system → messages なので、区切りより前の system も一緒にキャッシュされる。
 * 答案の画像（可変部）は区切りの後ろに置き、キャッシュに入れない
 */
function buildAnthropicMessageParams(
  request: GradingRequest,
  cacheTtl: CacheTtl,
  useAdaptiveThinking: boolean
): MessageCreateParamsNonStreaming {
  const cacheControl: CacheControlEphemeral =
    cacheTtl === "1h" ? { type: "ephemeral", ttl: "1h" } : { type: "ephemeral" }
  const lastFixedIndex = request.fixedParts.length - 1
  const fixedBlocks = request.fixedParts.map((part, index) =>
    index === lastFixedIndex
      ? { ...toContentBlock(part), cache_control: cacheControl }
      : toContentBlock(part)
  )
  const systemBlock: TextBlockParam =
    lastFixedIndex < 0
      ? { type: "text", text: request.systemText, cache_control: cacheControl }
      : { type: "text", text: request.systemText }
  return {
    model: request.model,
    max_tokens: request.maxOutputTokens,
    system: [systemBlock],
    messages: [
      {
        role: "user",
        content: [...fixedBlocks, ...request.variableParts.map(toContentBlock)],
      },
    ],
    ...(useAdaptiveThinking
      ? {
          thinking: { type: "adaptive" },
          output_config: {
            effort: request.effort,
            format: { type: "json_schema", schema: request.outputSchema },
          },
        }
      : {
          output_config: {
            format: { type: "json_schema", schema: request.outputSchema },
          },
        }),
  }
}

/** 公開日時を ISO 8601 にする。分からない（読めない・エポックの値）なら null */
function toCreatedAt(createdAt: string): string | null {
  const createdTime = Date.parse(createdAt)
  if (!Number.isFinite(createdTime) || createdTime <= 0) return null
  return new Date(createdTime).toISOString()
}

/**
 * SDK のモデルの情報を、事業者に依存しない形にする。
 * adaptive thinking と effort は一緒に送るので、両方に対応しているときだけ true にする
 */
export function toAnthropicModelInfo(modelInfo: ModelInfo): ProviderModelInfo {
  const capabilities = modelInfo.capabilities
  return {
    id: modelInfo.id,
    displayName:
      modelInfo.display_name.trim() === ""
        ? modelInfo.id
        : modelInfo.display_name,
    createdAt: toCreatedAt(modelInfo.created_at),
    supportsAdaptiveThinking:
      capabilities === null
        ? null
        : capabilities.thinking.types.adaptive.supported &&
          capabilities.effort.supported,
  }
}

function toProviderUsage(usage: Usage): ProviderUsage {
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
  }
}

/** 応答の最後のテキスト（思考の後ろに来る、JSON の本体） */
function getFinalText(message: Message): string {
  const textBlocks = message.content.flatMap((block) =>
    block.type === "text" ? [block.text] : []
  )
  return textBlocks.at(-1) ?? ""
}

/** Messages API の応答を揃えた形にする。stop_reason を見てから中身を読む */
function toAnthropicGradingResponse(message: Message): ProviderGradingResponse {
  const usage = toProviderUsage(message.usage)
  const rawText = getFinalText(message)
  switch (message.stop_reason) {
    case "end_turn":
      return createCompletedResponse(rawText, usage)
    case "refusal": {
      const explanation =
        message.stop_details?.explanation ??
        message.stop_details?.category ??
        "理由は示されていません"
      return {
        parsedJson: null,
        rawText,
        usage,
        stop: "refused",
        errorMessage: `モデルが応答を拒否しました: ${explanation}`,
        errorKind: null,
      }
    }
    case "max_tokens":
    case "model_context_window_exceeded":
      return {
        parsedJson: null,
        rawText,
        usage,
        stop: "max_tokens",
        errorMessage: `出力が上限で打ち切られました（${message.stop_reason}）`,
        errorKind: null,
      }
    default:
      return {
        ...createErrorResponse(
          "invalid_output",
          `想定していない終わり方です（${message.stop_reason ?? "null"}）`,
          usage
        ),
        rawText,
      }
  }
}

function toErrorKindFromErrorObject(
  errorObject: ErrorObject
): ProviderErrorKind {
  switch (errorObject.type) {
    case "invalid_request_error":
    case "not_found_error":
      return "bad_request"
    case "authentication_error":
      return "authentication"
    case "permission_error":
    case "billing_error":
      return "permission"
    case "rate_limit_error":
      return "rate_limit"
    case "timeout_error":
      return "timeout"
    case "api_error":
    case "overloaded_error":
      return "server"
  }
}

/** バッチの1件の結果を揃えた形にする */
function toAnthropicBatchResponse(
  result: MessageBatchResult
): ProviderGradingResponse {
  switch (result.type) {
    case "succeeded":
      return toAnthropicGradingResponse(result.message)
    case "errored":
      return createErrorResponse(
        toErrorKindFromErrorObject(result.error.error),
        result.error.error.message
      )
    case "canceled":
      return createErrorResponse("canceled", "バッチが取り消されました")
    case "expired":
      return createErrorResponse(
        "expired",
        "バッチの処理期限までに処理されませんでした"
      )
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
function toAnthropicProviderError(error: unknown): GradingProviderError {
  if (error instanceof GradingProviderError) return error
  const message = error instanceof Error ? error.message : String(error)
  return new GradingProviderError(toErrorKind(error), message, { cause: error })
}

async function callAnthropic<T>(call: () => PromiseLike<T>): Promise<T> {
  try {
    return await call()
  } catch (error) {
    throw toAnthropicProviderError(error)
  }
}

/**
 * Anthropic の事業者を作る。
 *
 * @param client - `new Anthropic({ apiKey, fetch })` で作ったクライアント（テストでは偽物）
 */
export function createAnthropicProvider(
  client: AnthropicGradingClient,
  options: AnthropicProviderOptions = {}
): GradingProvider {
  const catalogModels = options.catalogModels ?? []
  const buildParams = (request: GradingRequest, cacheTtl: CacheTtl) =>
    buildAnthropicMessageParams(
      request,
      cacheTtl,
      decideAdaptiveThinking(request.model, catalogModels)
    )
  return {
    id: "anthropic",
    capabilities: {
      batch: true,
      promptCache: "explicit",
      structuredOutput: "json_schema",
    },

    async grade(request, signal) {
      const message = await callAnthropic(() =>
        client.messages
          .stream(buildParams(request, "5m"), { signal })
          .finalMessage()
      )
      return toAnthropicGradingResponse(message)
    },

    async submitBatch(requests) {
      assertValidBatchRequests(requests)
      const batch = await callAnthropic(() =>
        client.messages.batches.create({
          requests: requests.map((request) => ({
            custom_id: request.customId,
            params: buildParams(request, "1h"),
          })),
        })
      )
      return { externalBatchId: batch.id }
    },

    async getBatchStatus(externalBatchId): Promise<ProviderBatchStatus> {
      const batch = await callAnthropic(() =>
        client.messages.batches.retrieve(externalBatchId)
      )
      return batch.processing_status
    },

    async *readBatchResults(externalBatchId) {
      try {
        const entries = await client.messages.batches.results(externalBatchId)
        for await (const entry of entries) {
          yield {
            customId: entry.custom_id,
            response: toAnthropicBatchResponse(entry.result),
          }
        }
      } catch (error) {
        throw toAnthropicProviderError(error)
      }
    },

    async cancelBatch(externalBatchId) {
      await callAnthropic(() => client.messages.batches.cancel(externalBatchId))
    },

    /**
     * 取り込み終えたバッチを消す。結果（答案への判定）は消さなければ事業者側で読み出せる
     * 状態のまま残るので、取り込んだらすぐ消す。処理が終わったバッチだけが消せる
     */
    async cleanupBatch(externalBatchId) {
      await callAnthropic(() => client.messages.batches.delete(externalBatchId))
    },

    async testConnection() {
      await callAnthropic(() => client.models.list({ limit: 1 }))
    },

    async listModels() {
      try {
        const models: ProviderModelInfo[] = []
        // 新しい順に返ってくる。ページをまたいで SDK が続きを読む
        for await (const modelInfo of client.models.list({
          limit: MODEL_LIST_PAGE_SIZE,
        })) {
          models.push(toAnthropicModelInfo(modelInfo))
        }
        return models
      } catch (error) {
        throw toAnthropicProviderError(error)
      }
    },
  }
}
