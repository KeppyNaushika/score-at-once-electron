/**
 * OpenAI の事業者実装のテスト。SDK のクライアントは偽物を渡し、通信はしない
 */

import { AuthenticationError, RateLimitError } from "openai"
import type { Batch, BatchCreateParams } from "openai/resources/batches"
import type { FileCreateParams, FileObject } from "openai/resources/files"
import type { Model } from "openai/resources/models"
import type {
  Response as OpenAiResponse,
  ResponseCreateParamsNonStreaming,
  ResponseOutputItem,
} from "openai/resources/responses/responses"
import { describe, expect, it, vi } from "vitest"

import type { OpenAiGradingClient } from "../../electron-src/lib/aiGrading/providers/openaiProvider"
import { createOpenAiProvider } from "../../electron-src/lib/aiGrading/providers/openaiProvider"
import { GradingProviderError } from "../../electron-src/lib/aiGrading/providers/providerShared"
import type { GradingRequest } from "../../electron-src/lib/aiGrading/providers/types"
import { PROVIDER_SUPPORTS_BATCH } from "../../src/lib/shared/aiGrading/modelFeatures"
import { createFakeModelPage } from "./helpers/fakeModelPage"

const OUTPUT_SCHEMA = {
  type: "object",
  properties: { status: { type: "string", enum: ["correct", "incorrect"] } },
  required: ["status"],
  additionalProperties: false,
}

function createGradingRequest(
  customId: string,
  answerImage = "QU5TV0VS"
): GradingRequest {
  return {
    customId,
    model: "gpt-5.5",
    effort: "low",
    maxOutputTokens: 3000,
    systemText: "あなたは採点者です",
    fixedParts: [
      { kind: "text", text: "問題文" },
      { kind: "image", mediaType: "image/jpeg", base64Data: "TU9ERUw=" },
    ],
    variableParts: [
      { kind: "image", mediaType: "image/png", base64Data: answerImage },
    ],
    outputSchema: OUTPUT_SCHEMA,
    outputSchemaName: "stage1_grading",
  }
}

function createMessageItem(
  content: Extract<ResponseOutputItem, { type: "message" }>["content"]
): ResponseOutputItem {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    status: "completed",
    content,
  }
}

function createOpenAiResponse(
  overrides: Partial<OpenAiResponse> = {}
): OpenAiResponse {
  return {
    id: "resp_test",
    access_programs: null,
    created_at: 0,
    output_text: "",
    error: null,
    incomplete_details: null,
    instructions: null,
    metadata: null,
    model: "gpt-5.5",
    object: "response",
    output: [],
    parallel_tool_calls: false,
    temperature: null,
    tool_choice: "auto",
    tools: [],
    top_p: null,
    status: "completed",
    usage: {
      input_tokens: 1000,
      input_tokens_details: { cached_tokens: 700, cache_write_tokens: 200 },
      output_tokens: 40,
      output_tokens_details: { reasoning_tokens: 10 },
      total_tokens: 1040,
    },
    ...overrides,
  }
}

function createBatch(overrides: Partial<Batch> = {}): Batch {
  return {
    id: "batch_test",
    completion_window: "24h",
    created_at: 0,
    endpoint: "/v1/responses",
    input_file_id: "file_input",
    object: "batch",
    status: "in_progress",
    ...overrides,
  }
}

function createFileObject(): FileObject {
  return {
    id: "file_input",
    bytes: 0,
    created_at: 0,
    filename: "grading.jsonl",
    object: "file",
    purpose: "batch",
    status: "uploaded",
  }
}

function createFakeClient(options: {
  response?: OpenAiResponse
  createError?: Error
  batch?: Batch
  fileContents?: Record<string, string>
  models?: Model[]
  listModelsError?: Error
}) {
  const createResponseCall = vi.fn(
    async (
      _params: ResponseCreateParamsNonStreaming,
      _options?: { signal?: AbortSignal }
    ) => {
      if (options.createError) throw options.createError
      return options.response ?? createOpenAiResponse()
    }
  )
  const createFileCall = vi.fn(async (_params: FileCreateParams) =>
    createFileObject()
  )
  const createBatchCall = vi.fn(async (_params: BatchCreateParams) =>
    createBatch()
  )
  const deleteFileCall = vi.fn(async (fileId: string) => ({
    id: fileId,
    deleted: true,
  }))
  const client: OpenAiGradingClient = {
    responses: { create: createResponseCall },
    files: {
      create: createFileCall,
      content: async (fileId: string) =>
        new Response(options.fileContents?.[fileId] ?? ""),
      delete: deleteFileCall,
    },
    batches: {
      create: createBatchCall,
      retrieve: async () => options.batch ?? createBatch(),
      cancel: async () => createBatch({ status: "cancelling" }),
    },
    models: {
      list: () =>
        createFakeModelPage(options.models ?? [], options.listModelsError),
    },
  }
  return {
    client,
    createResponseCall,
    createFileCall,
    createBatchCall,
    deleteFileCall,
  }
}

describe("openaiProvider", () => {
  describe("依頼の形", () => {
    it("Responses API の json_schema（strict）・reasoning.effort・画像を固定部の後ろに置く", async () => {
      const { client, createResponseCall } = createFakeClient({})
      await createOpenAiProvider(client).grade(
        createGradingRequest("attempt-1"),
        new AbortController().signal
      )
      const [params, requestOptions] = createResponseCall.mock.calls[0]
      expect(params.model).toBe("gpt-5.5")
      expect(params.instructions).toBe("あなたは採点者です")
      expect(params.max_output_tokens).toBe(3000)
      expect(params.reasoning).toEqual({ effort: "low" })
      expect(params.text).toEqual({
        format: {
          type: "json_schema",
          name: "stage1_grading",
          schema: OUTPUT_SCHEMA,
          strict: true,
        },
      })
      expect(params.store).toBe(false)
      expect(params.input).toEqual([
        {
          role: "user",
          content: [
            { type: "input_text", text: "問題文" },
            {
              type: "input_image",
              detail: "high",
              image_url: "data:image/jpeg;base64,TU9ERUw=",
            },
            {
              type: "input_image",
              detail: "high",
              image_url: "data:image/png;base64,QU5TV0VS",
            },
          ],
        },
      ])
      expect(requestOptions?.signal).toBeInstanceOf(AbortSignal)
    })

    it("prompt_cache_key は固定部だけで決まり、答案の画像では変わらない", async () => {
      const { client, createResponseCall } = createFakeClient({})
      const provider = createOpenAiProvider(client)
      const signal = new AbortController().signal
      await provider.grade(createGradingRequest("a", "QQ=="), signal)
      await provider.grade(createGradingRequest("b", "Qg=="), signal)
      await provider.grade(
        { ...createGradingRequest("c"), fixedParts: [] },
        signal
      )
      const cacheKeys = createResponseCall.mock.calls.map(
        ([params]) => params.prompt_cache_key
      )
      expect(cacheKeys[0]).toMatch(/^[0-9a-f]{32}$/)
      expect(cacheKeys[1]).toBe(cacheKeys[0])
      expect(cacheKeys[2]).not.toBe(cacheKeys[0])
    })
  })

  describe("応答の読み方", () => {
    it("出力テキストを JSON として読み、キャッシュの内訳を引いて使用量を揃える", async () => {
      const { client } = createFakeClient({
        response: createOpenAiResponse({
          output: [
            createMessageItem([
              {
                type: "output_text",
                text: '{"status":"correct"}',
                annotations: [],
              },
            ]),
          ],
        }),
      })
      const response = await createOpenAiProvider(client).grade(
        createGradingRequest("attempt-1"),
        new AbortController().signal
      )
      expect(response).toEqual({
        parsedJson: { status: "correct" },
        rawText: '{"status":"correct"}',
        usage: {
          inputTokens: 100,
          outputTokens: 40,
          cacheReadTokens: 700,
          cacheWriteTokens: 200,
        },
        stop: "completed",
        errorMessage: "",
        errorKind: null,
      })
    })

    it("refusal の出力は refused", async () => {
      const { client } = createFakeClient({
        response: createOpenAiResponse({
          output: [
            createMessageItem([{ type: "refusal", refusal: "できません" }]),
          ],
        }),
      })
      const response = await createOpenAiProvider(client).grade(
        createGradingRequest("attempt-1"),
        new AbortController().signal
      )
      expect(response.stop).toBe("refused")
      expect(response.errorMessage).toContain("できません")
    })

    it("incomplete（max_output_tokens）は max_tokens", async () => {
      const { client } = createFakeClient({
        response: createOpenAiResponse({
          status: "incomplete",
          incomplete_details: { reason: "max_output_tokens" },
          output: [
            createMessageItem([
              { type: "output_text", text: '{"sta', annotations: [] },
            ]),
          ],
        }),
      })
      const response = await createOpenAiProvider(client).grade(
        createGradingRequest("attempt-1"),
        new AbortController().signal
      )
      expect(response.stop).toBe("max_tokens")
      expect(response.parsedJson).toBeNull()
    })

    it("SDK の型付きエラーを GradingProviderError の kind に写す", async () => {
      const { client } = createFakeClient({
        createError: new RateLimitError(
          429,
          undefined,
          "rate limited",
          new Headers()
        ),
      })
      const failure = await createOpenAiProvider(client)
        .grade(createGradingRequest("attempt-1"), new AbortController().signal)
        .catch((error: unknown) => error)
      expect(failure).toBeInstanceOf(GradingProviderError)
      expect(
        failure instanceof GradingProviderError ? failure.kind : null
      ).toBe("rate_limit")
    })
  })

  describe("バッチ", () => {
    it("JSONL を batch 用に上げ、/v1/responses のバッチを作る", async () => {
      const { client, createFileCall, createBatchCall } = createFakeClient({})
      const result = await createOpenAiProvider(client).submitBatch([
        createGradingRequest("first"),
        createGradingRequest("second"),
      ])
      expect(result).toEqual({ externalBatchId: "batch_test" })

      const [fileParams] = createFileCall.mock.calls[0]
      expect(fileParams.purpose).toBe("batch")
      // 取り込めなかったときも事業者側に残り続けないよう、期限を付けて上げる（2日）
      expect(fileParams.expires_after).toEqual({
        anchor: "created_at",
        seconds: 2 * 24 * 60 * 60,
      })
      const uploadedFile = fileParams.file
      expect(uploadedFile).toBeInstanceOf(File)
      const jsonlText =
        uploadedFile instanceof File ? await uploadedFile.text() : ""
      const lines = jsonlText.split("\n").map((line) => JSON.parse(line))
      expect(lines).toHaveLength(2)
      expect(lines[0]).toMatchObject({
        custom_id: "first",
        method: "POST",
        url: "/v1/responses",
        body: { model: "gpt-5.5", store: false },
      })
      expect(lines[1].custom_id).toBe("second")

      expect(createBatchCall.mock.calls[0][0]).toEqual({
        input_file_id: "file_input",
        endpoint: "/v1/responses",
        completion_window: "24h",
        output_expires_after: {
          anchor: "created_at",
          seconds: 7 * 24 * 60 * 60,
        },
      })
    })

    it("custom_id の形が違えば上げない", async () => {
      const { client, createFileCall } = createFakeClient({})
      await expect(
        createOpenAiProvider(client).submitBatch([
          createGradingRequest("exam-student:crop-region"),
        ])
      ).rejects.toBeInstanceOf(GradingProviderError)
      expect(createFileCall).not.toHaveBeenCalled()
    })

    it("出力と失敗のファイルを読み、custom_id で対応付ける", async () => {
      const succeededBody = createOpenAiResponse({
        output: [
          createMessageItem([
            {
              type: "output_text",
              text: '{"status":"incorrect"}',
              annotations: [],
            },
          ]),
        ],
      })
      const outputLines = [
        JSON.stringify({
          id: "batch_req_2",
          custom_id: "second",
          response: { status_code: 200, request_id: "r2", body: succeededBody },
          error: null,
        }),
        JSON.stringify({
          id: "batch_req_3",
          custom_id: "third",
          response: {
            status_code: 400,
            request_id: "r3",
            body: { error: { message: "invalid image" } },
          },
          error: null,
        }),
      ]
      const errorLines = [
        JSON.stringify({
          id: "batch_req_1",
          custom_id: "first",
          response: null,
          error: { code: "batch_expired", message: "expired" },
        }),
        "これは JSON ではない",
      ]
      const { client } = createFakeClient({
        batch: createBatch({
          status: "expired",
          output_file_id: "file_output",
          error_file_id: "file_error",
        }),
        fileContents: {
          file_output: `${outputLines.join("\n")}\n`,
          file_error: errorLines.join("\n"),
        },
      })
      const provider = createOpenAiProvider(client)
      await expect(provider.getBatchStatus("batch_test")).resolves.toBe("ended")

      const results = []
      for await (const result of provider.readBatchResults("batch_test")) {
        results.push(result)
      }
      const responseByCustomId = new Map(
        results.map((result) => [result.customId, result.response])
      )
      expect([...responseByCustomId.keys()].sort()).toEqual([
        "first",
        "second",
        "third",
      ])
      expect(responseByCustomId.get("second")).toMatchObject({
        stop: "completed",
        parsedJson: { status: "incorrect" },
        usage: { inputTokens: 100, cacheReadTokens: 700 },
      })
      expect(responseByCustomId.get("third")).toMatchObject({
        stop: "error",
        errorKind: "bad_request",
        errorMessage: "invalid image",
      })
      expect(responseByCustomId.get("first")).toMatchObject({
        stop: "error",
        errorKind: "expired",
      })
    })

    it("バッチの状態を揃える", async () => {
      const statuses: [Batch["status"], string][] = [
        ["validating", "in_progress"],
        ["finalizing", "in_progress"],
        ["cancelling", "canceling"],
        ["completed", "ended"],
        ["cancelled", "ended"],
        ["failed", "failed"],
      ]
      for (const [status, expected] of statuses) {
        const { client } = createFakeClient({ batch: createBatch({ status }) })
        await expect(
          createOpenAiProvider(client).getBatchStatus("batch_test")
        ).resolves.toBe(expected)
      }
    })

    it("取り込んだバッチの入力・出力・失敗のファイルを消す（答案の画像を残さない）", async () => {
      const { client, deleteFileCall } = createFakeClient({
        batch: createBatch({
          status: "completed",
          output_file_id: "file_output",
          error_file_id: "file_error",
        }),
      })
      const provider = createOpenAiProvider(client)
      await provider.cleanupBatch?.("batch_test")

      expect(deleteFileCall.mock.calls.map(([fileId]) => fileId)).toEqual([
        "file_input",
        "file_output",
        "file_error",
      ])
    })
  })

  describe("モデルの一覧", () => {
    function createModel(id: string, created: number): Model {
      return { id, created, object: "model", owned_by: "openai" }
    }

    it("全件を読み、新しい順に並べ、名前は id・能力は null にする", async () => {
      const { client } = createFakeClient({
        models: [
          createModel("gpt-old", 1_600_000_000),
          createModel("gpt-unknown-date", 0),
          createModel("gpt-new", 1_800_000_000),
        ],
      })
      const models = await createOpenAiProvider(client).listModels()
      expect(models).toEqual([
        {
          id: "gpt-new",
          displayName: "gpt-new",
          createdAt: new Date(1_800_000_000_000).toISOString(),
          supportsAdaptiveThinking: null,
        },
        {
          id: "gpt-old",
          displayName: "gpt-old",
          createdAt: new Date(1_600_000_000_000).toISOString(),
          supportsAdaptiveThinking: null,
        },
        {
          id: "gpt-unknown-date",
          displayName: "gpt-unknown-date",
          createdAt: null,
          supportsAdaptiveThinking: null,
        },
      ])
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
      const failure = await createOpenAiProvider(client)
        .listModels()
        .catch((error: unknown) => error)
      expect(failure instanceof GradingProviderError && failure.kind).toBe(
        "authentication"
      )
    })

    it("バッチで送れるかは、画面が使う値と同じ", () => {
      const { client } = createFakeClient({})
      expect(createOpenAiProvider(client).capabilities.batch).toBe(
        PROVIDER_SUPPORTS_BATCH.openai
      )
    })
  })
})
