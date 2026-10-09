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
 * 各段の検証（`stage1ResponseValidator.ts`・`stage2ResponseValidator.ts`）を通す。規約は `__tests__/aiGrading/gradingSchema.test.ts`
 * が再帰的に検査する。
 *
 * main（事業者への送信）と renderer（画面の説明）の両方から引くので `src/lib/shared/` に置く。
 */

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

/** 部分点（partialScore）を持ちうる判定（partial は必ず持ち、pending は任意） */
export const AI_GRADING_SCORED_STATUSES = [
  "partial",
  "pending",
] as const satisfies readonly AiGradingOutputStatus[]

/** 全項目を required にし、余分な項目を許さないオブジェクトの節を作る */
export const strictObject = (
  properties: Readonly<Record<string, GradingJsonSchema>>
): GradingJsonSchema => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
})
