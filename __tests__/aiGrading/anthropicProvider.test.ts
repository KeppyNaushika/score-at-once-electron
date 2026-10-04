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
import { describe, expect, it, vi } from "vitest"

import type { AnthropicGradingClient } from "../../electron-src/lib/aiGrading/providers/anthropicProvider"
import { createAnthropicProvider } from "../../electron-src/lib/aiGrading/providers/anthropicProvider"
import { GradingProviderError } from "../../electron-src/lib/aiGrading/providers/providerShared"
import type { GradingRequest } from "../../electron-src/lib/aiGrading/providers/types"

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

function createFakeClient(options: {
  message?: Message
  createError?: Error
  batchResults?: MessageBatchIndividualResponse[]
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
      },
    },
    models: { list: async () => ({ data: [] }) },
  }
  return { client, createMessageCall, createBatchCall }
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
