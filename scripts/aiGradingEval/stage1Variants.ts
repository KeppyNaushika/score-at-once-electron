/**
 * 1段目の評価の依頼を組み立てる。
 *
 * アプリと同じ1段目（`stage1Grading.ts`）の文面を使い、指示（システムプロンプト）だけを
 * ファイルで差し替えられる（`systemTextOverride`）。案を詰める途中の文面は scratchpad に置いて
 * 走らせ、採用した文面だけをリポジトリへ入れる。
 *
 * ルーブリック項目を渡すと、項目の節を載せ、当てはまる項目の id を送った id で縛って検証する
 * （次の往復の測定。`buildRubricFromStage2.ts` が2段目の案から作った項目を渡す）。
 *
 * デモ試験の写しにはプロンプトの行が無いので、問題文・模範解答・採点基準は空にし、
 * 模範解答のページから切り出した画像を添える（`sendModelAnswerImage` を入れたときと同じ）。
 */

import { buildGradingVariableParts } from "../../src/lib/shared/aiGrading/promptBuilder"
import type { PromptImage } from "../../src/lib/shared/aiGrading/promptBuilder"
import {
  buildStage1OutputSchema,
  buildStage1RequestParts,
} from "../../src/lib/shared/aiGrading/stage1Grading"
import { validateStage1Response } from "../../src/lib/shared/aiGrading/stage1ResponseValidator"
import type { RubricItemForPrompt } from "../../src/types/rubric.types"
import { toJsonSchemaObject } from "../../electron-src/lib/aiGrading/gradingRequestFactory"
import type {
  JsonObject,
  PromptPart,
} from "../../electron-src/lib/aiGrading/providers/types"

import type { EvalQuestion } from "./devData"
import type { Stage1EvalVerdict } from "./stage1Metrics"

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
}

/** 1マスぶんの依頼を組み立てる */
export function buildStage1EvalRequest(input: {
  question: EvalQuestion
  modelAnswerImage: PromptImage | null
  answerImage: PromptImage
  systemTextOverride: string | null
  /** 送るルーブリック項目（無ければ空） */
  rubricItems: readonly RubricItemForPrompt[]
}): Stage1EvalRequest {
  const maxPoints = input.question.points
  const rubricItemIds = input.rubricItems.map((rubricItem) => rubricItem.id)
  const { systemText, fixedParts } = buildStage1RequestParts({
    prompt: EMPTY_PROMPT,
    points: maxPoints,
    modelAnswerImage: input.modelAnswerImage,
    rubricItems: input.rubricItems,
    teacherInstructions: [],
  })
  return {
    systemText: input.systemTextOverride ?? systemText,
    parts: [...fixedParts, ...buildGradingVariableParts(input.answerImage)],
    schema: toJsonSchemaObject(buildStage1OutputSchema(rubricItemIds)),
    readVerdict: (structuredOutput) => {
      const validation = validateStage1Response(structuredOutput, {
        maxPoints,
        rubricItemIds,
      })
      if (!validation.ok) return { ok: false, reasons: validation.reasons }
      return { ok: true, ...validation.value }
    },
  }
}
