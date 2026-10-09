/**
 * 1段目の評価で比べるプロンプトの案。
 *
 * - baseline: 今の1回で全部返す形（`promptBuilder.ts` の `buildGradingRequestParts`）
 * - stage1: 新しい1段目（`stage1Grading.ts`）
 *
 * どちらも、指示（システムプロンプト）だけをファイルで差し替えられる（`systemTextOverride`）。
 * 案を詰める途中の文面は scratchpad に置いて走らせ、採用した文面だけをリポジトリへ入れる。
 *
 * デモ試験の写しにはプロンプトの行が無いので、問題文・模範解答・採点基準は空にし、
 * 模範解答のページから切り出した画像を添える（`sendModelAnswerImage` を入れたときと同じ）。
 */

import { estimateAnnotationCharacterLimit } from "../../src/lib/shared/aiGrading/annotationPlacement"
import { validateGradingResponse } from "../../src/lib/shared/aiGrading/gradingResponseValidator"
import { buildGradingOutputSchema } from "../../src/lib/shared/aiGrading/gradingSchema"
import {
  buildGradingRequestParts,
  buildGradingVariableParts,
  type PromptImage,
} from "../../src/lib/shared/aiGrading/promptBuilder"
import {
  buildStage1OutputSchema,
  buildStage1RequestParts,
} from "../../src/lib/shared/aiGrading/stage1Grading"
import { validateStage1Response } from "../../src/lib/shared/aiGrading/stage1ResponseValidator"
import { getOrientedPaperDimensions } from "../../src/lib/paperSize"
import { toJsonSchemaObject } from "../../electron-src/lib/aiGrading/gradingRequestFactory"
import type {
  JsonObject,
  PromptPart,
} from "../../electron-src/lib/aiGrading/providers/types"

import type { EvalQuestion } from "./devData"
import type { Stage1EvalVerdict } from "./stage1Metrics"

export const STAGE1_VARIANTS = ["baseline", "stage1"] as const
export type Stage1Variant = (typeof STAGE1_VARIANTS)[number]

export interface Stage1EvalRequest {
  systemText: string
  parts: PromptPart[]
  schema: JsonObject
  /** 応答を検証し、評価の形にする */
  readVerdict: (structuredOutput: unknown) => Stage1EvalVerdict
}

const EMPTY_PROMPT = {
  questionText: "",
  modelAnswerText: "",
  rubricText: "",
  annotationInstruction: "",
}

/** 1マスぶんの依頼を組み立てる */
export function buildStage1EvalRequest(input: {
  variant: Stage1Variant
  question: EvalQuestion
  pageSize: string
  modelAnswerImage: PromptImage | null
  answerImage: PromptImage
  systemTextOverride: string | null
}): Stage1EvalRequest {
  const { question } = input
  const maxPoints = question.points
  const variableParts = buildGradingVariableParts(input.answerImage)

  if (input.variant === "baseline") {
    const paper = getOrientedPaperDimensions(input.pageSize, false)
    const { systemText, fixedParts } = buildGradingRequestParts({
      prompt: EMPTY_PROMPT,
      points: maxPoints,
      modelAnswerImage: input.modelAnswerImage,
      annotationCharacterLimit: estimateAnnotationCharacterLimit(
        question.rect.width * paper.width,
        question.rect.height * paper.height
      ),
    })
    return {
      systemText: input.systemTextOverride ?? systemText,
      parts: [...fixedParts, ...variableParts],
      schema: toJsonSchemaObject(buildGradingOutputSchema()),
      readVerdict: (structuredOutput) => {
        const validation = validateGradingResponse(structuredOutput, {
          maxPoints,
        })
        if (!validation.ok) return { ok: false, reasons: validation.reasons }
        const { value } = validation
        return {
          ok: true,
          status: value.status,
          partialScore: value.partialScore,
          confidence: value.confidence,
          transcription: value.transcription,
          observation: value.comment,
        }
      },
    }
  }

  const { systemText, fixedParts } = buildStage1RequestParts({
    prompt: EMPTY_PROMPT,
    points: maxPoints,
    modelAnswerImage: input.modelAnswerImage,
    rubricItems: [],
  })
  return {
    systemText: input.systemTextOverride ?? systemText,
    parts: [...fixedParts, ...variableParts],
    schema: toJsonSchemaObject(buildStage1OutputSchema([])),
    readVerdict: (structuredOutput) => {
      const validation = validateStage1Response(structuredOutput, {
        maxPoints,
        rubricItemIds: [],
      })
      if (!validation.ok) return { ok: false, reasons: validation.reasons }
      return { ok: true, ...validation.value }
    },
  }
}
