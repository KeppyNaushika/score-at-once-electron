/**
 * 実行1回ぶんの送信の材料（画像・固定部・出力スキーマ）をそろえ、事業者の応答（1段目）を
 * 試行に書く形へ直す。Electron に依存しない（テストは偽の事業者で走らせる）。
 */

import type { AiPrompt, CropRegion, ExamPage } from "@prisma/client"
import * as fsPromises from "fs/promises"
import * as path from "path"

import type { GradingJsonSchema } from "@/lib/shared/aiGrading/gradingSchema"
import type { PromptImage } from "@/lib/shared/aiGrading/promptBuilder"
import {
  type Stage1ValidationContext,
  validateStage1Response,
} from "@/lib/shared/aiGrading/stage1ResponseValidator"

import type { AiGradingAttemptResult } from "../prisma/aiGradingRun"
import { cropRegionForSending } from "./answerImage"
import type {
  JsonObject,
  ProviderGradingResponse,
  ProviderUsage,
} from "./providers/types"

/** 1段目の出力の上限（思考を含む。Anthropic は思考トークンも出力として数える） */
export const GRADING_MAX_OUTPUT_TOKENS = 16000

/** 2段目の出力の上限（全員分の案を1回で返すので、1段目より大きく取る） */
export const GROUPING_MAX_OUTPUT_TOKENS = 32000

/** 出力の形の名前（OpenAI の json_schema の name）。段ごとに分ける */
export const STAGE1_OUTPUT_SCHEMA_NAME = "stage1_grading"
export const STAGE2_OUTPUT_SCHEMA_NAME = "stage2_grouping"

/** データディレクトリからの相対パスを絶対パスにする口（テストでは一時ディレクトリへ） */
export type ResolveDataPath = (relativePath: string) => string

/** PNG のバイト列を、送る画像にする */
export function toPngPromptImage(png: Buffer): PromptImage {
  return { mediaType: "image/png", base64Data: png.toString("base64") }
}

/** 共通の書き方の JSON Schema を、事業者へ渡す JSON の値に写す（型を合わせるだけ） */
export function toJsonSchemaObject(schema: GradingJsonSchema): JsonObject {
  const schemaObject: JsonObject = {
    type: typeof schema.type === "string" ? schema.type : [...schema.type],
  }
  if (schema.description !== undefined) {
    schemaObject.description = schema.description
  }
  if (schema.enum) schemaObject.enum = [...schema.enum]
  if (schema.properties) {
    schemaObject.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([propertyName, property]) => [
        propertyName,
        toJsonSchemaObject(property),
      ])
    )
  }
  if (schema.required) schemaObject.required = [...schema.required]
  if (schema.additionalProperties === false) {
    schemaObject.additionalProperties = false
  }
  if (schema.items) schemaObject.items = toJsonSchemaObject(schema.items)
  return schemaObject
}

/** 問題用紙の画像（プロンプトに付けたもの）を読む。拡張子で形式を決める */
async function readQuestionImage(
  questionImagePath: string,
  resolveDataPath: ResolveDataPath
): Promise<PromptImage> {
  const imageBytes = await fsPromises.readFile(
    resolveDataPath(questionImagePath)
  )
  const extension = path.extname(questionImagePath).toLowerCase()
  return {
    mediaType:
      extension === ".jpg" || extension === ".jpeg"
        ? "image/jpeg"
        : "image/png",
    base64Data: imageBytes.toString("base64"),
  }
}

/** プロンプトに付く画像（問題用紙・模範解答の切り出し）。無いものは null */
export async function loadPromptImages(input: {
  prompt: AiPrompt
  cropRegion: CropRegion
  examPage: ExamPage
  imageScale: number
  resolveDataPath: ResolveDataPath
}): Promise<{
  questionImage: PromptImage | null
  modelAnswerImage: PromptImage | null
}> {
  const { prompt, cropRegion, examPage, imageScale, resolveDataPath } = input
  const questionImage = prompt.questionImagePath
    ? await readQuestionImage(prompt.questionImagePath, resolveDataPath)
    : null
  const modelAnswerImage =
    prompt.sendModelAnswerImage && examPage.imagePath
      ? toPngPromptImage(
          (
            await cropRegionForSending(
              resolveDataPath(examPage.imagePath),
              cropRegion,
              { imageScale }
            )
          ).png
        )
      : null
  return { questionImage, modelAnswerImage }
}

/** 試行を、失敗として終わらせる結果 */
export function toFailedAttemptResult(
  state: "errored" | "refused" | "expired",
  errorMessage: string,
  usage?: ProviderUsage
): AiGradingAttemptResult {
  return {
    state,
    status: "unscored",
    partialScore: null,
    transcription: "",
    observation: "",
    matchedRubricItemIds: [],
    confidence: "",
    errorMessage,
    inputTokens: usage?.inputTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
    cacheReadTokens: usage?.cacheReadTokens ?? 0,
    cacheWriteTokens: usage?.cacheWriteTokens ?? 0,
  }
}

/**
 * 事業者の応答（1段目）を、試行に書く結果にする。判定は必ず検証を通す（設計 §6-1）。
 *
 * 検証で直したこと（丸め・correct への寄せ・重なった項目の id）は errorMessage に残す。
 * succeeded の行の errorMessage は「受け取るときに直したこと」を表す（空なら直していない）
 */
export function toAttemptResult(
  response: ProviderGradingResponse,
  context: Stage1ValidationContext
): AiGradingAttemptResult {
  const { usage } = response
  switch (response.stop) {
    case "refused":
      return toFailedAttemptResult("refused", response.errorMessage, usage)
    case "max_tokens":
      return toFailedAttemptResult("errored", response.errorMessage, usage)
    case "error":
      return toFailedAttemptResult(
        response.errorKind === "expired" ? "expired" : "errored",
        response.errorMessage,
        usage
      )
    case "completed":
      break
  }

  const validation = validateStage1Response(response.parsedJson, context)
  if (!validation.ok) {
    return toFailedAttemptResult(
      "errored",
      `判定の検証で外れました: ${validation.reasons.join(" / ")}`,
      usage
    )
  }
  const { value, notes } = validation
  return {
    state: "succeeded",
    status: value.status,
    partialScore: value.partialScore,
    transcription: value.transcription,
    observation: value.observation,
    matchedRubricItemIds: value.matchedRubricItemIds,
    confidence: value.confidence,
    errorMessage: notes.join(" / "),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheReadTokens: usage.cacheReadTokens,
    cacheWriteTokens: usage.cacheWriteTokens,
  }
}
