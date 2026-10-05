/**
 * AI 採点で VLM に返させる JSON の形（JSON Schema）
 *
 * 全事業者（Anthropic・OpenAI・Gemini・OpenAI 互換）が受け付ける共通の書き方だけを使う
 * （docs/vlm-grading-design.md §6-2）:
 *
 * - 使うのは type・properties・required・additionalProperties・enum・description だけ
 * - `oneOf` / `anyOf` / `minimum` / `maximum` / `pattern` / `format` などは使わない
 *   （事業者によって拒まれるか、黙って無視される）
 * - 全項目を required にし、オブジェクトはすべて `additionalProperties: false`
 * - null は型の union（`["number", "null"]`）で表す
 *
 * 範囲（0〜配点）や刻み（0.01）はスキーマで縛れないので、受け取った JSON は必ず
 * `gradingResponseValidator.ts` の検証を通す。規約は `__tests__/aiGrading/gradingSchema.test.ts`
 * が再帰的に検査する。
 *
 * main（事業者への送信）と renderer（画面の説明）の両方から引くので `src/lib/shared/` に置く。
 */

import { AI_GRADING_CONFIDENCES } from "@/types/aiGrading.types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

type JsonSchemaPrimitiveType =
  "string" | "number" | "integer" | "boolean" | "null" | "object" | "array"

/** このファイルで組み立てる JSON Schema の節。共通の書き方で使える語だけを型に持つ */
export interface GradingJsonSchema {
  readonly type: JsonSchemaPrimitiveType | readonly JsonSchemaPrimitiveType[]
  readonly description?: string
  readonly enum?: readonly string[]
  readonly properties?: Readonly<Record<string, GradingJsonSchema>>
  readonly required?: readonly string[]
  readonly additionalProperties?: false
  readonly items?: GradingJsonSchema
}

/**
 * AI に返させる判定。`unscored`（未採点）と `double_mark`（二重マーク）は返させない
 * （前者は判定ではなく、後者はマークシートの読み取りの結果で、記述の採点では起きない）
 */
export const AI_GRADING_OUTPUT_STATUSES = [
  "correct",
  "partial",
  "incorrect",
  "no_answer",
  "pending",
] as const satisfies readonly ScoringStatus[]
export type AiGradingOutputStatus = (typeof AI_GRADING_OUTPUT_STATUSES)[number]

/** 部分点（partialScore）を持つ判定 */
export const AI_GRADING_SCORED_STATUSES = [
  "partial",
  "pending",
] as const satisfies readonly AiGradingOutputStatus[]

/** 全項目を required にし、余分な項目を許さないオブジェクトの節を作る */
const strictObject = (
  properties: Readonly<Record<string, GradingJsonSchema>>
): GradingJsonSchema => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
})

/** 採点の出力（答案1件への判定） */
export function buildGradingOutputSchema(): GradingJsonSchema {
  return strictObject({
    transcription: {
      type: "string",
      description: "答案に書かれている内容の読み取り",
    },
    status: {
      type: "string",
      enum: AI_GRADING_OUTPUT_STATUSES,
      description:
        "判定。correct=正答 / partial=部分点 / incorrect=誤答 / no_answer=無答 / pending=保留",
    },
    partialScore: {
      type: ["number", "null"],
      description:
        "partial と pending のときだけ、0 から配点までの点（0.01 単位）。それ以外は null",
    },
    comment: {
      type: "string",
      description:
        "教員向けの、その点にした理由だけ（不自然な記述があったときは、その報告も）",
    },
    annotation: {
      type: ["string", "null"],
      description: "生徒向けの朱書き（改行を入れない）。書かないときは null",
    },
    confidence: {
      type: "string",
      enum: AI_GRADING_CONFIDENCES,
      description: "判定の確信度",
    },
  })
}

/** プロンプトの改訂の出力（直したプロンプトの各欄と、教員への説明） */
export function buildRevisionOutputSchema(): GradingJsonSchema {
  return strictObject({
    questionText: { type: "string", description: "問題文" },
    modelAnswerText: { type: "string", description: "模範解答" },
    rubricText: { type: "string", description: "採点基準" },
    annotationInstruction: {
      type: "string",
      description: "朱書きの指示（量・書き方・どの答案に入れるか）",
    },
    message: {
      type: "string",
      description: "何をどう直したかの、教員への短い説明",
    },
  })
}
