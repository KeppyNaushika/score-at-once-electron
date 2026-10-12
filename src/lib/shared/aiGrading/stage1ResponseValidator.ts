/**
 * 1段目（答案ごとの判定）の応答を、記録する前に検証する（docs/vlm-grading-design.md §6-1）
 *
 * - 形: `buildStage1OutputSchema()` の6項目（類型方式の設問は7項目）がそろい、余分な項目が無く、型が合う
 * - 字数: 読み取り・所見が上限以内（守れなかった出力は採用しない。§12）
 * - 判定と点: `applyStatusScoreRules`（採点の検証と同じ規則）
 * - 当てはまる項目: 送った項目の id だけ。重なりは1つにまとめて notes に残す
 * - 類型方式の設問（類型を送ったとき。§4-8-6）: 判定は evaluated / no_answer / pending で、点は持たない。
 *   evaluated は送った類型の id（`scaleLevelId`）を必ず持ち、ほかの判定では null
 */

import {
  type AiGradingConfidence,
  isAiGradingConfidence,
} from "@/types/aiGrading.types"

import {
  type AiGradingOutputStatus,
  aiGradingOutputStatusesFor,
} from "./gradingSchema"
import {
  applyStatusScoreRules,
  isAiGradingOutputStatusFor,
  isRecord,
  readBoundedString,
} from "./responseRules"
import {
  buildStage1OutputSchema,
  STAGE1_OBSERVATION_MAX_LENGTH,
  STAGE1_TRANSCRIPTION_MAX_LENGTH,
} from "./stage1Grading"

/** 検証を通った1段目の判定 */
interface ValidatedStage1Response {
  readonly transcription: string
  readonly observation: string
  readonly status: AiGradingOutputStatus
  readonly partialScore: number | null
  /** 類型方式の設問で選んだ類型（evaluated のときだけ値を持つ） */
  readonly scaleLevelId: string | null
  readonly matchedRubricItemIds: readonly string[]
  readonly confidence: AiGradingConfidence
}

type Stage1ResponseValidation =
  | {
      readonly ok: true
      readonly value: ValidatedStage1Response
      readonly notes: readonly string[]
    }
  | { readonly ok: false; readonly reasons: readonly string[] }

export interface Stage1ValidationContext {
  /** 送ったときの配点。配点の無い設問は null */
  readonly maxPoints: number | null
  /** 送った項目の id */
  readonly rubricItemIds: readonly string[]
  /**
   * 送った類型の id（類型方式の設問だけ。ほかの設問は空）。空でなければ類型方式の応答として検証する。
   * バッチの結果は時間を置いて届くので、送った一覧の文（`AiPrompt.renderedScaleLevels`）から読み戻して渡す
   */
  readonly scaleLevelIds: readonly string[]
}

/** 類型方式の設問の判定と類型を確かめる（点は持たない） */
function readScaleVerdict(
  response: Record<string, unknown>,
  status: AiGradingOutputStatus,
  scaleLevelIds: readonly string[],
  reasons: string[]
): string | null {
  if (response.partialScore !== null) {
    reasons.push("類型方式の設問では partialScore を null にします")
  }
  const { scaleLevelId } = response
  if (status !== "evaluated") {
    if (scaleLevelId !== null) {
      reasons.push(`${status} には scaleLevelId を付けられません`)
    }
    return null
  }
  if (
    typeof scaleLevelId !== "string" ||
    !scaleLevelIds.includes(scaleLevelId)
  ) {
    reasons.push(
      `evaluated の scaleLevelId が送った類型の id ではありません: ${String(scaleLevelId)}`
    )
    return null
  }
  return scaleLevelId
}

/** 当てはまる項目の id を読む。知らない id は理由に、重なりは notes に足す */
function readMatchedIds(
  field: unknown,
  rubricItemIds: readonly string[],
  reasons: string[],
  notes: string[]
): string[] {
  if (!Array.isArray(field)) {
    reasons.push("matchedRubricItemIds が配列ではありません")
    return []
  }
  const knownIds = new Set(rubricItemIds)
  const matchedIds: string[] = []
  field.forEach((rubricItemId) => {
    if (typeof rubricItemId !== "string" || !knownIds.has(rubricItemId)) {
      reasons.push(`送っていない項目の id があります: ${String(rubricItemId)}`)
      return
    }
    if (matchedIds.includes(rubricItemId)) {
      notes.push(`重なった項目の id を1つにまとめました: ${rubricItemId}`)
      return
    }
    matchedIds.push(rubricItemId)
  })
  return matchedIds
}

/** 1段目の応答（パース済みの JSON）を検証する */
export function validateStage1Response(
  response: unknown,
  context: Stage1ValidationContext
): Stage1ResponseValidation {
  if (!isRecord(response)) {
    return { ok: false, reasons: ["応答が JSON のオブジェクトではありません"] }
  }
  const reasons: string[] = []
  const notes: string[] = []
  const isScaleQuestion = context.scaleLevelIds.length > 0
  const outputKeys: readonly string[] =
    buildStage1OutputSchema([], context.scaleLevelIds).required ?? []

  const missingKeys = outputKeys.filter((key) => !(key in response))
  if (missingKeys.length > 0) {
    reasons.push(`項目が足りません: ${missingKeys.join(", ")}`)
  }
  const unknownKeys = Object.keys(response).filter(
    (key) => !outputKeys.includes(key)
  )
  if (unknownKeys.length > 0) {
    reasons.push(`知らない項目があります: ${unknownKeys.join(", ")}`)
  }

  const transcription = readBoundedString(
    response,
    "transcription",
    STAGE1_TRANSCRIPTION_MAX_LENGTH,
    reasons
  )
  const observation = readBoundedString(
    response,
    "observation",
    STAGE1_OBSERVATION_MAX_LENGTH,
    reasons
  )
  const matchedRubricItemIds = readMatchedIds(
    response.matchedRubricItemIds,
    context.rubricItemIds,
    reasons,
    notes
  )

  const { confidence } = response
  if (!isAiGradingConfidence(confidence)) {
    reasons.push(
      `confidence が high / medium / low のいずれでもありません: ${String(confidence)}`
    )
  }

  const rawScore = response.partialScore
  const isScoreNumber =
    typeof rawScore === "number" && Number.isFinite(rawScore)
  if (rawScore !== null && !isScoreNumber) {
    reasons.push("partialScore が数でも null でもありません")
  }

  if (!isAiGradingOutputStatusFor(response.status, isScaleQuestion)) {
    reasons.push(
      `status が ${aiGradingOutputStatusesFor(isScaleQuestion).join(" / ")} のいずれでもありません: ${String(response.status)}`
    )
    return { ok: false, reasons }
  }
  if (isScaleQuestion) {
    const scaleLevelId = readScaleVerdict(
      response,
      response.status,
      context.scaleLevelIds,
      reasons
    )
    if (reasons.length > 0 || !isAiGradingConfidence(confidence)) {
      return { ok: false, reasons }
    }
    return {
      ok: true,
      value: {
        transcription,
        observation,
        status: response.status,
        partialScore: null,
        scaleLevelId,
        matchedRubricItemIds,
        confidence,
      },
      notes,
    }
  }
  const { status, partialScore } = applyStatusScoreRules({
    status: response.status,
    partialScore: isScoreNumber ? rawScore : null,
    partialScoreIsExplicitNull: rawScore === null,
    maxPoints: context.maxPoints,
    reasons,
    notes,
  })

  if (reasons.length > 0 || !isAiGradingConfidence(confidence)) {
    return { ok: false, reasons }
  }
  return {
    ok: true,
    value: {
      transcription,
      observation,
      status,
      partialScore,
      scaleLevelId: null,
      matchedRubricItemIds,
      confidence,
    },
    notes,
  }
}
