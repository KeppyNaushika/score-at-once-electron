/**
 * 2段目の案の選択肢を検証する（docs/vlm-grading-design.md §6-2・§6-4）
 *
 * - adjust: pointDelta があり（0 でなく、絶対値が配点以内、0.01 単位）、setStatus・setScore は null
 * - set: setStatus が判定の値で、pointDelta は null。setScore は判定と点の規則（1段目と同じ）
 * - 選択肢は 1〜`STAGE2_MAX_OPTIONS` 個、推奨はちょうど1つ
 * - 類型方式の設問（類型を送ったとき。§4-8-6）: set だけで、setStatus は evaluated / no_answer / pending。
 *   evaluated は送った類型の id（setScaleLevelId）を必ず持ち、ほかでは null。pointDelta・setScore は null
 */

import {
  RUBRIC_EFFECT_KINDS,
  type RubricEffectKind,
} from "@/types/rubric.types"
import { isOneOf } from "@/types/stringUnion"

import type { AiGradingOutputStatus } from "./gradingSchema"
import {
  applyStatusScoreRules,
  isAiGradingOutputStatusFor,
  isRecord,
  readBoundedString,
} from "./responseRules"
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
  /** 類型方式の設問で、その類型にする選択肢（setStatus が evaluated のときだけ） */
  readonly setScaleLevelId: string | null
  readonly rationale: string
  readonly recommended: boolean
}

interface OptionValidationContext {
  /** 理由に出す案の位置（`proposals[0]`） */
  readonly path: string
  readonly maxPoints: number | null
  /** 送った類型の id（類型方式の設問だけ。ほかの設問は空）。空でなければ類型方式の選択肢として検証する */
  readonly scaleLevelIds: readonly string[]
  readonly reasons: string[]
  readonly adjustments: string[]
}

/** 選択肢の項目の名前（類型方式の設問か） */
const optionKeysFor = (isScaleQuestion: boolean): readonly string[] =>
  buildStage2OutputSchema([], isScaleQuestion).properties?.proposals?.items
    ?.properties?.options?.items?.required ?? []
const OPTION_KEYS = optionKeysFor(false)
const SCALE_OPTION_KEYS = optionKeysFor(true)

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
  const isScaleQuestion = context.scaleLevelIds.length > 0
  const optionKeys = isScaleQuestion ? SCALE_OPTION_KEYS : OPTION_KEYS
  const unknownKeys = Object.keys(option).filter(
    (key) => !optionKeys.includes(key)
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

  if (isScaleQuestion) {
    return validateScaleOption(option, path, context, rationale, recommended)
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
      setScaleLevelId: null,
      rationale,
      recommended,
    }
  }

  if (option.pointDelta !== null) {
    reasons.push(`${path}: set の pointDelta は null にします`)
  }
  if (!isAiGradingOutputStatusFor(option.setStatus, false)) {
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
    setScaleLevelId: null,
    rationale,
    recommended,
  }
}

/** 類型方式の設問の選択肢1つを検証する（set だけ・点なし・evaluated は送った類型） */
function validateScaleOption(
  option: Record<string, unknown>,
  path: string,
  context: OptionValidationContext,
  rationale: string,
  recommended: boolean
): ValidatedStage2Option | null {
  const { reasons } = context
  if (option.effectKind !== "set") {
    reasons.push(`${path}: 類型方式の設問では点を加減する選択肢を作れません`)
    return null
  }
  if (option.pointDelta !== null || option.setScore !== null) {
    reasons.push(
      `${path}: 類型方式の設問の pointDelta・setScore は null にします`
    )
  }
  const { setStatus, setScaleLevelId } = option
  if (!isAiGradingOutputStatusFor(setStatus, true)) {
    reasons.push(
      `${path}.setStatus が類型方式の判定（evaluated / no_answer / pending）ではありません: ${String(setStatus)}`
    )
    return null
  }
  if (setStatus !== "evaluated") {
    if (setScaleLevelId !== null) {
      reasons.push(`${path}: ${setStatus} の setScaleLevelId は null にします`)
    }
  } else if (
    typeof setScaleLevelId !== "string" ||
    !context.scaleLevelIds.includes(setScaleLevelId)
  ) {
    reasons.push(
      `${path}.setScaleLevelId が送った類型の id ではありません: ${String(setScaleLevelId)}`
    )
    return null
  }
  return {
    effectKind: "set",
    pointDelta: null,
    setStatus,
    setScore: null,
    setScaleLevelId:
      setStatus === "evaluated" && typeof setScaleLevelId === "string"
        ? setScaleLevelId
        : null,
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
