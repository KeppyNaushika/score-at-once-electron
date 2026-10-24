/**
 * 2段目（特徴を揃えて、採点項目の案を作る）の文面と出力の形
 * （docs/vlm-grading-design.md §3-4・§6-2・§7-2）
 *
 * 1段目の結果（読み取り・所見・判定）を、画像を付けずに全員分まとめて1回で送る。
 * 答案は送信用の仮の番号（A1, A2, …）で識別し、生徒の氏名も attempt の id も送らない。
 * 仮の番号と attempt の対応は、呼び出し側が `answerKeys` の並びで持つ。
 * **指示の文言を変えたら `STAGE2_TEMPLATE_VERSION` を上げる。**
 */

import type { AiGradingConfidence } from "@/types/aiGrading.types"
import {
  RUBRIC_EFFECT_KINDS,
  type RubricItemForPrompt,
} from "@/types/rubric.types"

import { AI_GRADING_CONFIDENCE_LABELS } from "./confidenceLabels"
import {
  AI_GRADING_OUTPUT_STATUSES,
  AI_GRADING_SCALE_OUTPUT_STATUSES,
  type AiGradingOutputStatus,
  type GradingJsonSchema,
  strictObject,
} from "./gradingSchema"
import {
  formatPointsSection,
  type GradingRequestParts,
  joinPromptSegments,
  type PromptTextFields,
  textSection,
} from "./promptBuilder"
import {
  formatRubricItemsSection,
  OUTPUT_STATUS_LABELS,
} from "./rubricItemsText"
import {
  formatScaleLevelsSection,
  type ScaleLevelForPrompt,
  scaleLevelLabelText,
} from "./scaleLevelsText"
import {
  STAGE2_SCALE_SYSTEM_TEXT,
  STAGE2_SYSTEM_TEXT,
} from "./stage2SystemText"

/** 2段目の指示の版 */
export const STAGE2_TEMPLATE_VERSION = "stage2-5"
/** 類型方式の設問の2段目の指示の版（`STAGE2_SCALE_SYSTEM_TEXT` の文言を変えたら上げる） */
export const STAGE2_SCALE_TEMPLATE_VERSION = "stage2-scale-1"

/** 設問の方式で使う2段目の指示の版（類型方式の設問か） */
export const stage2TemplateVersionFor = (isScaleQuestion: boolean): string =>
  isScaleQuestion ? STAGE2_SCALE_TEMPLATE_VERSION : STAGE2_TEMPLATE_VERSION

/** 案の名前・説明・助言の文案・選択肢の理由の字数の上限 */
export const STAGE2_LABEL_MAX_LENGTH = 30
export const STAGE2_DESCRIPTION_MAX_LENGTH = 100
export const STAGE2_ADVICE_MAX_LENGTH = 40
export const STAGE2_RATIONALE_MAX_LENGTH = 60
export const STAGE2_NOTES_MAX_LENGTH = 300
/** 案ごとの選択肢の数の上限 */
export const STAGE2_MAX_OPTIONS = 4

/** 2段目へ送る、1段目の結果1件 */
export interface Stage2AnswerInput {
  readonly status: AiGradingOutputStatus
  readonly partialScore: number | null
  /** 類型方式の設問で1段目が選んだ類型（evaluated のときだけ） */
  readonly scaleLevelId: string | null
  readonly confidence: AiGradingConfidence
  readonly transcription: string
  readonly observation: string
  readonly matchedRubricItemIds: readonly string[]
}

interface Stage2RequestInput {
  prompt: PromptTextFields
  points: number | null
  rubricItems: readonly RubricItemForPrompt[]
  /**
   * 類型方式の設問の類型（並び順）。類型方式でない設問は省くか空。あれば配点の代わりに
   * 類型の節を置き、類型方式の指示にする
   */
  scaleLevels?: readonly ScaleLevelForPrompt[]
  /**
   * 送る答案（この並びで A1, A2, … を振る）。教員の「その他」の指示は再採点（1段目）への
   * 指示なので、ここには送らない
   */
  answers: readonly Stage2AnswerInput[]
}

/** 送信用の仮の番号（1始まり）。並びが同じなら同じ番号になる */
export function stage2AnswerKey(answerIndex: number): string {
  return `A${answerIndex + 1}`
}

/**
 * 仮の判定の書き方。類型を選んだ答案は点の代わりに類型の記号を書く（類型の点数は送らない）
 */
function formatVerdict(
  answer: Stage2AnswerInput,
  scaleLevels: readonly ScaleLevelForPrompt[]
): string {
  if (answer.status === "evaluated") {
    const scaleLevel = scaleLevels.find(
      (candidate) => candidate.id === answer.scaleLevelId
    )
    return `仮の評価: ${scaleLevel ? `類型 ${scaleLevelLabelText(scaleLevel)}` : "類型（不明）"}`
  }
  const scoreText =
    answer.partialScore === null ? "" : `（${answer.partialScore}点）`
  const heading = scaleLevels.length > 0 ? "仮の評価" : "仮の判定"
  return `${heading}: ${OUTPUT_STATUS_LABELS[answer.status]}${scoreText}`
}

/** 答案1件を数行の文にする（画像は無いので、読み取りと所見がすべて） */
function formatAnswer(
  answer: Stage2AnswerInput,
  answerIndex: number,
  scaleLevels: readonly ScaleLevelForPrompt[]
): string {
  const lines = [
    `[${stage2AnswerKey(answerIndex)}] ${formatVerdict(answer, scaleLevels)} ／ 確信度: ${AI_GRADING_CONFIDENCE_LABELS[answer.confidence]}`,
    `読み取り: ${answer.transcription.trim() === "" ? "（なし）" : answer.transcription.trim()}`,
    `所見: ${answer.observation.trim()}`,
  ]
  if (answer.matchedRubricItemIds.length > 0) {
    lines.push(
      `当てはまる既存の項目: ${answer.matchedRubricItemIds.join(", ")}`
    )
  }
  return lines.join("\n")
}

/** 2段目の依頼の文面と、仮の番号の並び */
export function buildStage2RequestParts(
  input: Stage2RequestInput
): GradingRequestParts & { answerKeys: string[] } {
  const { prompt, answers } = input
  const scaleLevels = input.scaleLevels ?? []
  return {
    systemText:
      scaleLevels.length > 0 ? STAGE2_SCALE_SYSTEM_TEXT : STAGE2_SYSTEM_TEXT,
    fixedParts: joinPromptSegments([
      formatScaleLevelsSection(scaleLevels) ??
        formatPointsSection(input.points),
      textSection("問題文", prompt.questionText),
      textSection("模範解答", prompt.modelAnswerText),
      textSection("採点基準", prompt.rubricText),
      textSection("助言の文案の指示", prompt.annotationInstruction),
      formatRubricItemsSection(input.rubricItems, scaleLevels),
      `## 答案の一覧（${answers.length}件）\n${answers
        .map((answer, answerIndex) =>
          formatAnswer(answer, answerIndex, scaleLevels)
        )
        .join("\n\n")}`,
    ]),
    answerKeys: answers.map((_answer, answerIndex) =>
      stage2AnswerKey(answerIndex)
    ),
  }
}

/** 類型方式の設問の選択肢の形。効き方は set だけで、類型の id を足す（点は null） */
const SCALE_OPTION_SCHEMA = strictObject({
  effectKind: {
    type: "string",
    enum: ["set"],
    description: "類型方式の設問では常に set",
  },
  pointDelta: {
    type: ["number", "null"],
    description: "類型方式の設問では常に null",
  },
  setStatus: {
    type: ["string", "null"],
    description: `決める判定（${AI_GRADING_SCALE_OUTPUT_STATUSES.join(" / ")}）。evaluated=類型にする`,
  },
  setScore: {
    type: ["number", "null"],
    description: "類型方式の設問では常に null",
  },
  setScaleLevelId: {
    type: ["string", "null"],
    description:
      "evaluated のときだけ、その類型の id（「類型」の節の id）。それ以外は null",
  },
  rationale: {
    type: "string",
    description: `教員向けの一言の理由（${STAGE2_RATIONALE_MAX_LENGTH}字以内）`,
  },
  recommended: {
    type: "boolean",
    description: "推奨の選択肢か（案ごとにちょうど1つ）",
  },
})

/**
 * 2段目の出力の形。答案の番号は送った番号の enum で縛る。
 *
 * 類型方式の設問（`isScaleQuestion`）は、選択肢を類型にする形（`SCALE_OPTION_SCHEMA`）にする。
 * 類型の id は enum を null と組めないので、検証（`stage2OptionValidator.ts`）で確かめる
 */
export function buildStage2OutputSchema(
  answerKeys: readonly string[],
  isScaleQuestion = false
): GradingJsonSchema {
  const pointOption = strictObject({
    effectKind: {
      type: "string",
      enum: RUBRIC_EFFECT_KINDS,
      description: "adjust=点を加減する / set=判定と点を決める",
    },
    pointDelta: {
      type: ["number", "null"],
      description: "adjust のときの加減（減点は負）。set のときは null",
    },
    setStatus: {
      type: ["string", "null"],
      description: `set のときの判定（${AI_GRADING_OUTPUT_STATUSES.join(" / ")}）。adjust のときは null`,
    },
    setScore: {
      type: ["number", "null"],
      description:
        "set で partial・pending のときの点。それ以外と adjust のときは null",
    },
    rationale: {
      type: "string",
      description: `教員向けの一言の理由（${STAGE2_RATIONALE_MAX_LENGTH}字以内）`,
    },
    recommended: {
      type: "boolean",
      description: "推奨の選択肢か（案ごとにちょうど1つ）",
    },
  })
  const proposal = strictObject({
    label: {
      type: "string",
      description: `教員向けの特徴の名前（${STAGE2_LABEL_MAX_LENGTH}字以内）`,
    },
    description: {
      type: "string",
      description: `特徴の説明（${STAGE2_DESCRIPTION_MAX_LENGTH}字以内）`,
    },
    adviceDraft: {
      type: "string",
      description: `生徒向けの助言の文案。一文（${STAGE2_ADVICE_MAX_LENGTH}字以内）。要らなければ空`,
    },
    matchedRubricItemId: {
      type: ["string", "null"],
      description: "既存の項目に該当する特徴ならその id。新しい特徴なら null",
    },
    memberAnswerKeys: {
      type: "array",
      items:
        answerKeys.length > 0
          ? { type: "string", enum: answerKeys }
          : { type: "string" },
      description: "この特徴に当てはまる答案の番号",
    },
    options: {
      type: "array",
      items: isScaleQuestion ? SCALE_OPTION_SCHEMA : pointOption,
      description: `選択肢（1〜${STAGE2_MAX_OPTIONS}個、推奨はちょうど1つ）`,
    },
  })
  return strictObject({
    proposals: { type: "array", items: proposal, description: "項目の案" },
    notes: {
      type: "string",
      description: `気づいた点（${STAGE2_NOTES_MAX_LENGTH}字以内。無ければ空）`,
    },
  })
}
