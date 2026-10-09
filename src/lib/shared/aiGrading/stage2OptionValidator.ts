/**
 * 2段目の案の選択肢を検証する（docs/vlm-grading-design.md §6-2・§6-4）
 *
 * - adjust: pointDelta があり（0 でなく、絶対値が配点以内、0.01 単位）、setStatus・setScore は null
 * - set: setStatus が判定の値で、pointDelta は null。setScore は判定と点の規則（1段目と同じ）
 * - 選択肢は 1〜`STAGE2_MAX_OPTIONS` 個、推奨はちょうど1つ
 */

import { isOneOf } from "@/types/stringUnion"

import {
  applyStatusScoreRules,
  isAiGradingOutputStatus,
  isRecord,
  readBoundedString,
} from "./gradingResponseValidator"
import type { AiGradingOutputStatus } from "./gradingSchema"
import { RUBRIC_EFFECT_KINDS, type RubricEffectKind } from "./rubricItemsText"
import {
  buildStage2OutputSchema,
  STAGE2_MAX_OPTIONS,
  STAGE2_RATIONALE_MAX_LENGTH,
} from "./stage2Grouping"

/** 検証を通った選択肢。RubricItem と同じ形（§5-3） */
export interface ValidatedStage2Option {
  readonly effectKind: RubricEffectKind
  readonly pointDelta: number | null
  readonly setStatus: AiGradingOutputStatus | null
  readonly setScore: number | null
  readonly rationale: string
  readonly recommended: boolean
}

interface OptionValidationContext {
  /** 理由に出す案の位置（`proposals[0]`） */
  readonly path: string
  readonly maxPoints: number | null
  readonly reasons: string[]
  readonly adjustments: string[]
}

const OPTION_KEYS: readonly string[] =
  buildStage2OutputSchema([]).properties?.proposals?.items?.properties?.options
    ?.items?.required ?? []

const isFiniteNumber = (candidate: unknown): candidate is number =>
  typeof candidate === "number" && Number.isFinite(candidate)

const hasFinerThanCent = (score: number): boolean =>
  Math.abs(score * 100 - Math.round(score * 100)) > 1e-9

/** adjust の加減を確かめる */
function checkPointDelta(
  pointDelta: unknown,
  path: string,
  context: OptionValidationContext
): number | null {
  const { maxPoints, reasons } = context
  if (!isFiniteNumber(pointDelta) || pointDelta === 0) {
    reasons.push(`${path}: adjust の pointDelta が 0 でない数ではありません`)
    return null
  }
  if (maxPoints === null) {
    reasons.push(`${path}: 配点の無い設問に点の加減は付けられません`)
  } else if (Math.abs(pointDelta) > maxPoints) {
    reasons.push(
      `${path}: pointDelta が配点（${maxPoints}点）を超えています: ${pointDelta}`
    )
  }
  if (hasFinerThanCent(pointDelta)) {
    reasons.push(
      `${path}: pointDelta が 0.01 単位ではありません: ${pointDelta}`
    )
  }
  return pointDelta
}

/** 選択肢1つを検証する */
function validateOption(
  option: unknown,
  path: string,
  context: OptionValidationContext
): ValidatedStage2Option | null {
  const { reasons, adjustments } = context
  if (!isRecord(option)) {
    reasons.push(`${path} がオブジェクトではありません`)
    return null
  }
  const unknownKeys = Object.keys(option).filter(
    (key) => !OPTION_KEYS.includes(key)
  )
  if (unknownKeys.length > 0) {
    reasons.push(`${path} に知らない項目があります: ${unknownKeys.join(", ")}`)
  }
  const rationale = readBoundedString(
    option,
    "rationale",
    STAGE2_RATIONALE_MAX_LENGTH,
    reasons,
    `${path}.rationale`
  )
  if (typeof option.recommended !== "boolean") {
    reasons.push(`${path}.recommended が真偽値ではありません`)
  }
  const recommended = option.recommended === true
  const { effectKind } = option
  if (
    typeof effectKind !== "string" ||
    !isOneOf(RUBRIC_EFFECT_KINDS, effectKind)
  ) {
    reasons.push(
      `${path}.effectKind が adjust / set のいずれでもありません: ${String(effectKind)}`
    )
    return null
  }

  if (effectKind === "adjust") {
    if (option.setStatus !== null || option.setScore !== null) {
      reasons.push(`${path}: adjust の setStatus・setScore は null にします`)
    }
    const pointDelta = checkPointDelta(option.pointDelta, path, context)
    return {
      effectKind,
      pointDelta,
      setStatus: null,
      setScore: null,
      rationale,
      recommended,
    }
  }

  if (option.pointDelta !== null) {
    reasons.push(`${path}: set の pointDelta は null にします`)
  }
  if (!isAiGradingOutputStatus(option.setStatus)) {
    reasons.push(
      `${path}.setStatus が判定の値ではありません: ${String(option.setStatus)}`
    )
    return null
  }
  const rawScore = option.setScore
  if (rawScore !== null && !isFiniteNumber(rawScore)) {
    reasons.push(`${path}.setScore が数でも null でもありません`)
  }
  const optionNotes: string[] = []
  const { status, partialScore } = applyStatusScoreRules({
    status: option.setStatus,
    partialScore: isFiniteNumber(rawScore) ? rawScore : null,
    partialScoreIsExplicitNull: rawScore === null,
    maxPoints: context.maxPoints,
    reasons,
    notes: optionNotes,
  })
  optionNotes.forEach((note) => adjustments.push(`${path}: ${note}`))
  return {
    effectKind,
    pointDelta: null,
    setStatus: status,
    setScore: partialScore,
    rationale,
    recommended,
  }
}

/** 案の選択肢の並びを検証する */
export function validateStage2Options(
  options: unknown,
  context: OptionValidationContext
): ValidatedStage2Option[] {
  const { path, reasons } = context
  if (!Array.isArray(options)) {
    reasons.push(`${path}.options が配列ではありません`)
    return []
  }
  if (options.length === 0 || options.length > STAGE2_MAX_OPTIONS) {
    reasons.push(
      `${path}.options の数が 1〜${STAGE2_MAX_OPTIONS} ではありません: ${options.length}`
    )
  }
  const validatedOptions = options.flatMap((option, optionIndex) => {
    const validated = validateOption(
      option,
      `${path}.options[${optionIndex}]`,
      context
    )
    return validated ? [validated] : []
  })
  const recommendedCount = validatedOptions.filter(
    (option) => option.recommended
  ).length
  if (recommendedCount !== 1) {
    reasons.push(
      `${path} の推奨の選択肢がちょうど1つではありません: ${recommendedCount}個`
    )
  }
  return validatedOptions
}
