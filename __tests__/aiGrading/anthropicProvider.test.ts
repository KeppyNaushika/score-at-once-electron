/**
 * Anthropic の事業者実装のテスト。SDK のクライアントは偽物を渡し、通信はしない
 */

import { AuthenticationError, RateLimitError } from "@anthropic-ai/sdk"
import type {
  BatchCreateParams,
  MessageBatch,
  MessageBatchIndividualResponse,
} from "@anthropic-ai/sdk/resources/messages/batches"
import type {
  ContentBlock,
  Message,
  MessageCreateParamsNonStreaming,
  StopReason,
} from "@anthropic-ai/sdk/resources/messages/messages"
import type { ModelInfo } from "@anthropic-ai/sdk/resources/models"
import { describe, expect, it, vi } from "vitest"

import type { AnthropicGradingClient } from "../../electron-src/lib/aiGrading/providers/anthropicProvider"
import {
  createAnthropicProvider,
  toAnthropicModelInfo,
} from "../../electron-src/lib/aiGrading/providers/anthropicProvider"
import { GradingProviderError } from "../../electron-src/lib/aiGrading/providers/providerShared"
import type {
  GradingRequest,
  ProviderModelInfo,
} from "../../electron-src/lib/aiGrading/providers/types"
import {
  decideAdaptiveThinking,
  PROVIDER_SUPPORTS_BATCH,
  supportsAdaptiveThinking,
} from "../../src/lib/shared/aiGrading/modelFeatures"
import { createFakeModelPage } from "./helpers/fakeModelPage"

const OUTPUT_SCHEMA = {
  type: "object",
  properties: { status: { type: "string", enum: ["correct", "incorrect"] } },
  required: ["status"],
  additionalProperties: false,
}

function createGradingRequest(customId: string): GradingRequest {
  return {
    customId,
    model: "claude-opus-5-5",
    effort: "high",
    maxOutputTokens: 4000,
    systemText: "あなたは採点者です",
    fixedParts: [
      { kind: "text", text: "問題文" },
      { kind: "image", mediaType: "image/png", base64Data: "TU9ERUw=" },
      { kind: "text", text: "採点基準" },
    ],
    variableParts: [
      { kind: "image", mediaType: "image/png", base64Data: "QU5TV0VS" },
    ],
    outputSchema: OUTPUT_SCHEMA,
    outputSchemaName: "stage1_grading",
  }
}

function createMessage(
  content: ContentBlock[],
  stopReason: StopReason,
  overrides: Partial<Message> = {}
): Message {
  return {
    id: "msg_test",
    container: null,
    content,
    diagnostics: null,
    model: "claude-opus-5-5",
    role: "assistant",
    stop_details: null,
    stop_reason: stopReason,
    stop_sequence: null,
    type: "message",
    usage: {
      cache_creation: null,
      cache_creation_input_tokens: 120,
      cache_read_input_tokens: 800,
      inference_geo: null,
      input_tokens: 50,
      output_tokens: 30,
      output_tokens_details: null,
      server_tool_use: null,
      service_tier: null,
    },
    ...overrides,
  }
}

function createTextBlock(text: string): ContentBlock {
  return { type: "text", text, citations: null }
}

function createMessageBatch(
  processingStatus: MessageBatch["processing_status"]
): MessageBatch {
  return {
    id: "msgbatch_test",
    archived_at: null,
    cancel_initiated_at: null,
    created_at: "2026-10-04T00:00:00Z",
    ended_at: null,
    expires_at: "2026-10-05T00:00:00Z",
    processing_status: processingStatus,
    request_counts: {
      canceled: 0,
      errored: 0,
      expired: 0,
      processing: 0,
      succeeded: 0,
    },
    results_url: null,
    type: "message_batch",
  }
}

async function* toAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  for (const item of items) yield item
}

/** モデルの一覧の1件（能力は既定で adaptive thinking と effort の両方に対応） */
function createModelInfo(
  id: string,
  overrides: {
    adaptive?: boolean
    effort?: boolean
    capabilities?: null
    createdAt?: string
    displayName?: string
  } = {}
): ModelInfo {
  const supported = (isSupported: boolean) => ({ supported: isSupported })
  return {
    id,
    display_name: overrides.displayName ?? `Display ${id}`,
    created_at: overrides.createdAt ?? "2026-09-01T00:00:00Z",
    max_input_tokens: 200000,
    max_tokens: 64000,
    type: "model",
    capabilities:
      overrides.capabilities === null
        ? null
        : {
            batch: supported(true),
            citations: supported(true),
            code_execution: supported(true),
            context_management: {
              clear_thinking_20251015: null,
              clear_tool_uses_20250919: null,
              compact_20260112: null,
              supported: true,
            },
            effort: {
              supported: overrides.effort ?? true,
              low: supported(true),
              medium: supported(true),
              high: supported(true),
              max: supported(true),
              xhigh: null,
            },
            image_input: supported(true),
            pdf_input: supported(true),
            structured_outputs: supported(true),
            thinking: {
              supported: true,
              types: {
                adaptive: supported(overrides.adaptive ?? true),
                enabled: supported(true),
              },
            },
          },
  }
}

function createFakeClient(options: {
  message?: Message
  createError?: Error
  batchResults?: MessageBatchIndividualResponse[]
  models?: ModelInfo[]
  listModelsError?: Error
}) {
  const createMessageCall = vi.fn(
    async (
      _params: MessageCreateParamsNonStreaming,
      _options?: { signal?: AbortSignal }
    ) => {
      if (options.createError) throw options.createError
      return options.message ?? createMessage([], "end_turn")
    }
  )
  const deleteBatchCall = vi.fn(async (messageBatchId: string) => ({
    id: messageBatchId,
    type: "message_batch_deleted",
  }))
  const createBatchCall = vi.fn(async (_params: BatchCreateParams) =>
    createMessageBatch("in_progress")
  )
  const client: AnthropicGradingClient = {
    messages: {
      create: createMessageCall,
      batches: {
        create: createBatchCall,
        retrieve: async () => createMessageBatch("ended"),
        results: async () => toAsyncIterable(options.batchResults ?? []),
        cancel: async () => createMessageBatch("canceling"),
        delete: deleteBatchCall,
      },
    },
    models: {
      list: () =>
        createFakeModelPage(options.models ?? [], options.listModelsError),
    },
  }
  return { client, createMessageCall, createBatchCall, deleteBatchCall }
}

describe("anthropicProvider", () => {
  describe("依頼の形", () => {
    it("固定部の最後にキャッシュの区切りを置き、答案の画像はその後ろに置く", async () => {
      const { client, createMessageCall } = createFakeClient({
        message: createMessage(
          [createTextBlock('{"status":"correct"}')],
          "end_turn"
        ),
      })
      const provider = createAnthropicProvider(client)
      await provider.grade(
        createGradingRequest("attempt-1"),
        new AbortController().signal
      )

      const [params, requestOptions] = createMessageCall.mock.calls[0]
      const firstMessage = params.messages[0]
      expect(firstMessage.role).toBe("user")
      const content = Array.isArray(firstMessage.content)
        ? firstMessage.content
        : []
      expect(content).toHaveLength(4)
      // 固定部の最後（採点基準）だけに区切りがある
      expect(content[2]).toEqual({
        type: "text",
        text: "採点基準",
        cache_control: { type: "ephemeral" },
      })
      expect(
        content.slice(0, 2).every((block) => !("cache_control" in block))
      ).toBe(true)
      // 答案の画像は区切りの後ろで、区切りを持たない
      expect(content[3]).toEqual({
        type: "image",
        source: { type: "base64", media_type: "image/png", data: "QU5TV0VS" },
      })
      // system には区切りが無い（固定部の区切りで一緒にキャッシュされる）
      expect(params.system).toEqual([
        { type: "text", text: "あなたは採点者です" },
      ])
      expect(requestOptions?.signal).toBeInstanceOf(AbortSignal)
    })

    it("思考は adaptive、output_config に effort と json_schema の format を入れる", async () => {
      const { client, createMessageCall } = createFakeClient({})
      await createAnthropicProvider(client).grade(
        createGradingRequest("attempt-1"),
        new AbortController().signal
      )
      const [params] = createMessageCall.mock.calls[0]
      expect(params.model).toBe("claude-opus-5-5")
      expect(params.max_tokens).toBe(4000)
      expect(params.thinking).toEqual({ type: "adaptive" })
      expect(params.output_config).toEqual({
        effort: "high",
        format: { type: "json_schema", schema: OUTPUT_SCHEMA },
      })
      // 古い output_format は使わない
      expect("output_format" in params).toBe(false)
    })

    it("adaptive thinking に対応しないモデル（Haiku 4.5）には thinking と effort を送らない", async () => {
      const { client, createMessageCall } = createFakeClient({})
      await createAnthropicProvider(client).grade(
        { ...createGradingRequest("attempt-1"), model: "claude-haiku-4-5" },
        new AbortController().signal
      )
      const [params] = createMessageCall.mock.calls[0]
      expect("thinking" in params).toBe(false)
      expect(params.output_config).toEqual({
        format: { type: "json_schema", schema: OUTPUT_SCHEMA },
      })
    })

    it("adaptive thinking の対応は許可リストで判定する", () => {
      expect(supportsAdaptiveThinking("claude-opus-5-5")).toBe(true)
      expect(supportsAdaptiveThinking("claude-sonnet-5-5")).toBe(true)
      expect(supportsAdaptiveThinking("claude-opus-4-8")).toBe(true)
      expect(supportsAdaptiveThinking("claude-haiku-4-5")).toBe(false)
      expect(supportsAdaptiveThinking("claude-sonnet-4-5")).toBe(false)
      expect(supportsAdaptiveThinking("unknown-model")).toBe(false)
    })

    it("取得した一覧が能力を言っていれば、許可リストより一覧に従う", async () => {
      const catalogModels: ProviderModelInfo[] = [
        {
          id: "claude-haiku-4-5",
          displayName: "Claude Haiku 4.5",
          createdAt: null,
          supportsAdaptiveThinking: true,
        },
        {
          id: "claude-opus-5-5",
          displayName: "Claude Opus 5.5",
          createdAt: null,
          supportsAdaptiveThinking: false,
        },
      ]
      const { client, createMessageCall } = createFakeClient({})
      const provider = createAnthropicProvider(client, { catalogModels })
      await provider.grade(
        { ...createGradingRequest("attempt-1"), model: "claude-haiku-4-5" },
        new AbortController().signal
      )
      await provider.grade(
        createGradingRequest("attempt-2"),
        new AbortController().signal
      )
      const [haikuParams] = createMessageCall.mock.calls[0]
      const [opusParams] = createMessageCall.mock.calls[1]
      expect(haikuParams.thinking).toEqual({ type: "adaptive" })
      expect("thinking" in opusParams).toBe(false)
    })

    it("adaptive thinking の判断: 一覧の能力 > 許可リスト。一覧に無い・能力が null なら許可リスト", () => {
      const catalogModels: ProviderModelInfo[] = [
        {
          id: "claude-new-model",
          displayName: "New",
          createdAt: null,
          supportsAdaptiveThinking: true,
        },
        {
          id: "claude-opus-5-5",
          displayName: "Opus",
          createdAt: null,
          supportsAdaptiveThinking: null,
        },
      ]
      expect(decideAdaptiveThinking("claude-new-model", catalogModels)).toBe(
        true
      )
      expect(decideAdaptiveThinking("claude-opus-5-5", catalogModels)).toBe(
        true
      )
      expect(decideAdaptiveThinking("claude-haiku-4-5", catalogModels)).toBe(
        false
      )
      expect(decideAdaptiveThinking("claude-new-model", [])).toBe(false)
    })

    it("固定部が空なら system に区切りを置く", async () => {
      const { client, createMessageCall } = createFakeClient({})
      await createAnthropicProvider(client).grade(
        { ...createGradingRequest("attempt-1"), fixedParts: [] },
        new AbortController().signal
      )
      const [params] = createMessageCall.mock.calls[0]
      expect(params.system).toEqual([
        {
          type: "text",
          text: "あなたは採点者です",
          cache_control: { type: "ephemeral" },
        },
      ])
    })
  })

  describe("応答の読み方", () => {
    it("思考の後ろの最後のテキストを JSON として読み、使用量を揃える", async () => {
      const { client } = createFakeClient({
        message: createMessage(
          [
            { type: "thinking", thinking: "考え中", signature: "sig" },
            createTextBlock('{"status":"correct"}'),
          ],
          "end_turn"
        ),
      })
      const response = await createAnthropicProvider(client).grade(
        createGradingRequest("attempt-1"),
        new AbortController().signal
      )
      expect(response).toEqual({
        parsedJson: { status: "correct" },
        rawText: '{"status":"correct"}',
        usage: {
          inputTokens: 50,
          outputTokens: 30,
          cacheReadTokens: 800,
          cacheWriteTokens: 120,
        },
        stop: "completed",
        errorMessage: "",
        errorKind: null,
      })
    })

    it("refusal は refused にし、JSON を読まない", async () => {
      const { client } = createFakeClient({
        message: createMessage([createTextBlock("")], "refusal", {
          stop_details: {
            type: "refusal",
            category: "general_harms",
            explanation: "説明",
          },
        }),
      })
      const response = await createAnthropicProvider(client).grade(
        createGradingRequest("attempt-1"),
        new AbortController().signal
      )
      expect(response.stop).toBe("refused")
      expect(response.parsedJson).toBeNull()
      expect(response.errorMessage).toContain("説明")
    })

    it("max_tokens は max_tokens にし、途中までの JSON を読まない", async () => {
      const { client } = createFakeClient({
        message: createMessage(
          [createTextBlock('{"status":"cor')],
          "max_tokens"
        ),
      })
      const response = await createAnthropicProvider(client).grade(
        createGradingRequest("attempt-1"),
        new AbortController().signal
      )
      expect(response.stop).toBe("max_tokens")
      expect(response.parsedJson).toBeNull()
      expect(response.rawText).toBe('{"status":"cor')
    })

    it("end_turn でも JSON として読めなければ invalid_output の error", async () => {
      const { client } = createFakeClient({
        message: createMessage([createTextBlock("正解です")], "end_turn"),
      })
      const response = await createAnthropicProvider(client).grade(
        createGradingRequest("attempt-1"),
        new AbortController().signal
      )
      expect(response.stop).toBe("error")
      expect(response.errorKind).toBe("invalid_output")
      expect(response.rawText).toBe("正解です")
    })
  })

  describe("失敗の対応付け", () => {
    it("SDK の型付きエラーを GradingProviderError の kind に写す", async () => {
      const cases: [Error, string][] = [
        [
          new RateLimitError(429, undefined, "rate limited", new Headers()),
          "rate_limit",
        ],
        [
          new AuthenticationError(401, undefined, "bad key", new Headers()),
          "authentication",
        ],
      ]
      for (const [createError, expectedKind] of cases) {
        const { client } = createFakeClient({ createError })
        const failure = await createAnthropicProvider(client)
          .grade(
            createGradingRequest("attempt-1"),
            new AbortController().signal
          )
          .catch((error: unknown) => error)
        expect(failure).toBeInstanceOf(GradingProviderError)
        expect(
          failure instanceof GradingProviderError ? failure.kind : null
        ).toBe(expectedKind)
      }
    })
  })

  describe("バッチ", () => {
    it("custom_id と 1h のキャッシュで投入する", async () => {
      const { client, createBatchCall } = createFakeClient({})
      const result = await createAnthropicProvider(client).submitBatch([
        createGradingRequest("6f1c2a9e-0d1b-4c55-9a51-1f2e3d4c5b6a"),
        createGradingRequest("attempt_2"),
      ])
      expect(result).toEqual({ externalBatchId: "msgbatch_test" })
      const [params] = createBatchCall.mock.calls[0]
      expect(params.requests.map((request) => request.custom_id)).toEqual([
        "6f1c2a9e-0d1b-4c55-9a51-1f2e3d4c5b6a",
        "attempt_2",
      ])
      const content = params.requests[0].params.messages[0].content
      const blocks = Array.isArray(content) ? content : []
      expect(blocks[2]).toMatchObject({
        cache_control: { type: "ephemeral", ttl: "1h" },
      })
    })

    it("custom_id の形が違う・重複していれば投入しない", async () => {
      const { client, createBatchCall } = createFakeClient({})
      const provider = createAnthropicProvider(client)
      await expect(
        provider.submitBatch([createGradingRequest("student:region")])
      ).rejects.toBeInstanceOf(GradingProviderError)
      await expect(
        provider.submitBatch([createGradingRequest("a".repeat(65))])
      ).rejects.toBeInstanceOf(GradingProviderError)
      await expect(
        provider.submitBatch([
          createGradingRequest("same"),
          createGradingRequest("same"),
        ])
      ).rejects.toBeInstanceOf(GradingProviderError)
      await expect(provider.submitBatch([])).rejects.toBeInstanceOf(
        GradingProviderError
      )
      expect(createBatchCall).not.toHaveBeenCalled()
    })

    it("結果は届いた順に custom_id 付きで返し、失敗の種類を揃える", async () => {
      const { client } = createFakeClient({
        batchResults: [
          {
            custom_id: "second",
            result: { type: "expired" },
          },
          {
            custom_id: "first",
            result: {
              type: "succeeded",
              message: createMessage(
                [createTextBlock('{"status":"incorrect"}')],
                "end_turn"
              ),
            },
          },
          {
            custom_id: "third",
            result: {
              type: "errored",
              error: {
                type: "error",
                request_id: null,
                error: { type: "overloaded_error", message: "overloaded" },
              },
            },
          },
          { custom_id: "fourth", result: { type: "canceled" } },
        ],
      })
      const results = []
      for await (const result of createAnthropicProvider(
        client
      ).readBatchResults("msgbatch_test")) {
        results.push(result)
      }
      const responseByCustomId = new Map(
        results.map((result) => [result.customId, result.response])
      )
      expect(results.map((result) => result.customId)).toEqual([
        "second",
        "first",
        "third",
        "fourth",
      ])
      expect(responseByCustomId.get("first")?.parsedJson).toEqual({
        status: "incorrect",
      })
      expect(responseByCustomId.get("second")?.errorKind).toBe("expired")
      expect(responseByCustomId.get("third")?.errorKind).toBe("server")
      expect(responseByCustomId.get("fourth")?.errorKind).toBe("canceled")
    })

    it("処理状態をそのまま返す", async () => {
      const { client } = createFakeClient({})
      await expect(
        createAnthropicProvider(client).getBatchStatus("msgbatch_test")
      ).resolves.toBe("ended")
    })
  })
})

describe("Anthropic の取り込み後の片付け", () => {
  it("取り込み終えたバッチを消す", async () => {
    const { client, deleteBatchCall } = createFakeClient({})
    await createAnthropicProvider(client).cleanupBatch?.("msgbatch_test")
    expect(deleteBatchCall).toHaveBeenCalledWith("msgbatch_test")
  })

  describe("モデルの一覧", () => {
    it("全件を読み、事業者に依存しない形にする（能力が無ければ null・エポックの日時は null）", async () => {
      const { client } = createFakeClient({
        models: [
          createModelInfo("claude-opus-5-5", {
            displayName: "Claude Opus 5.5",
          }),
          createModelInfo("claude-haiku-4-5", { adaptive: false }),
          createModelInfo("claude-sonnet-5-5", { effort: false }),
          createModelInfo("claude-legacy", {
            capabilities: null,
            createdAt: "1970-01-01T00:00:00Z",
            displayName: "",
          }),
        ],
      })
      const models = await createAnthropicProvider(client).listModels()
      expect(models).toEqual([
        {
          id: "claude-opus-5-5",
          displayName: "Claude Opus 5.5",
          createdAt: "2026-09-01T00:00:00.000Z",
          supportsAdaptiveThinking: true,
        },
        {
          id: "claude-haiku-4-5",
          displayName: "Display claude-haiku-4-5",
          createdAt: "2026-09-01T00:00:00.000Z",
          supportsAdaptiveThinking: false,
        },
        {
          id: "claude-sonnet-5-5",
          displayName: "Display claude-sonnet-5-5",
          createdAt: "2026-09-01T00:00:00.000Z",
          supportsAdaptiveThinking: false,
        },
        {
          id: "claude-legacy",
          displayName: "claude-legacy",
          createdAt: null,
          supportsAdaptiveThinking: null,
        },
      ])
    })

    it("SDK の能力の形をそのまま写す（toAnthropicModelInfo）", () => {
      expect(
        toAnthropicModelInfo(createModelInfo("claude-x"))
          .supportsAdaptiveThinking
      ).toBe(true)
    })

    it("一覧の取得の失敗は種類を付けて投げる", async () => {
      const { client } = createFakeClient({
        listModelsError: new AuthenticationError(
          401,
          undefined,
          "bad key",
          new Headers()
        ),
      })
      const failure = await createAnthropicProvider(client)
        .listModels()
        .catch((error: unknown) => error)
      expect(failure).toBeInstanceOf(GradingProviderError)
      expect(failure instanceof GradingProviderError && failure.kind).toBe(
        "authentication"
      )
    })

    it("バッチで送れるかは、画面が使う値と同じ", () => {
      const { client } = createFakeClient({})
      expect(createAnthropicProvider(client).capabilities.batch).toBe(
        PROVIDER_SUPPORTS_BATCH.anthropic
      )
    })
  })
})
