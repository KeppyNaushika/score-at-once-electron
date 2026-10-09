/**
 * 1段目（答案ごとの判定）の応答を、記録する前に検証する（docs/vlm-grading-design.md §6-1）
 *
 * - 形: `buildStage1OutputSchema()` の6項目がそろい、余分な項目が無く、型が合う
 * - 字数: 読み取り・所見が上限以内（守れなかった出力は採用しない。§12）
 * - 判定と点: `applyStatusScoreRules`（採点の検証と同じ規則）
 * - 当てはまる項目: 送った項目の id だけ。重なりは1つにまとめて notes に残す
 */

import {
  type AiGradingConfidence,
  isAiGradingConfidence,
} from "@/types/aiGrading.types"

import {
  AI_GRADING_OUTPUT_STATUSES,
  type AiGradingOutputStatus,
} from "./gradingSchema"
import {
  applyStatusScoreRules,
  isAiGradingOutputStatus,
  isRecord,
  readBoundedString,
} from "./responseRules"
import {
  buildStage1OutputSchema,
  STAGE1_OBSERVATION_MAX_LENGTH,
  STAGE1_TRANSCRIPTION_MAX_LENGTH,
} from "./stage1Grading"

/** 検証を通った1段目の判定 */
export interface ValidatedStage1Response {
  readonly transcription: string
  readonly observation: string
  readonly status: AiGradingOutputStatus
  readonly partialScore: number | null
  readonly matchedRubricItemIds: readonly string[]
  readonly confidence: AiGradingConfidence
}

export type Stage1ResponseValidation =
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
}

const OUTPUT_KEYS: readonly string[] =
  buildStage1OutputSchema([]).required ?? []

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

  const missingKeys = OUTPUT_KEYS.filter((key) => !(key in response))
  if (missingKeys.length > 0) {
    reasons.push(`項目が足りません: ${missingKeys.join(", ")}`)
  }
  const unknownKeys = Object.keys(response).filter(
    (key) => !OUTPUT_KEYS.includes(key)
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

  if (!isAiGradingOutputStatus(response.status)) {
    reasons.push(
      `status が ${AI_GRADING_OUTPUT_STATUSES.join(" / ")} のいずれでもありません: ${String(response.status)}`
    )
    return { ok: false, reasons }
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
      matchedRubricItemIds,
      confidence,
    },
    notes,
  }
}
