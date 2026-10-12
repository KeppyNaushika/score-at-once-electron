/**
 * 07 の類型評価の設問で、類型をどう見せ、どの類型を選ぶか（docs/vlm-grading-design.md §4-8-5・§4-8-6）。
 *
 * 類型は正誤を持たない。マスの色は採点状態の色ではなく、類型の並び順から決める
 * （A を正答の色、C を誤答の色にはしない）。
 */

import type { ScoreScaleLevelRow, ScoreScaleRow } from "@/queries/scoreScale"
import {
  isStatusCompatibleWithScoringMethod,
  type ScoringMethod,
} from "@/types/rubric.types"
import {
  isScoringStatus,
  type ScoringStatus,
} from "@/types/scoringStatus.types"

/** 07 が類型について読むもの（類型の行のうち、ボタンとマスに出す列） */
export type ScaleLevelChoice = Pick<
  ScoreScaleLevelRow,
  "id" | "label" | "description" | "score"
>

/** 類型1つの色（マスの地と文字） */
interface ScaleLevelColors {
  bg: string
  text: string
}

/**
 * 類型の色。並び順で引き、7つ目からは頭に戻る。
 *
 * 隣り合う類型が見分けられるよう色相を大きく離し、どれも採点状態の色（正答の緑・誤答の赤 など）と
 * 同じ意味に読まれないよう、先頭を正答の色に寄せない
 */
export const SCALE_LEVEL_PALETTE: readonly ScaleLevelColors[] = [
  { bg: "#DBEAFE", text: "#1E3A8A" }, // 青
  { bg: "#FEF3C7", text: "#78350F" }, // 黄
  { bg: "#FCE7F3", text: "#831843" }, // 桃
  { bg: "#CCFBF1", text: "#134E4A" }, // 青緑
  { bg: "#EDE9FE", text: "#4C1D95" }, // 紫
  { bg: "#FFEDD5", text: "#7C2D12" }, // 橙
]

/** 並び順（0 始まり）の類型の色 */
export const scaleLevelColorsAt = (order: number): ScaleLevelColors =>
  SCALE_LEVEL_PALETTE[
    ((order % SCALE_LEVEL_PALETTE.length) + SCALE_LEVEL_PALETTE.length) %
      SCALE_LEVEL_PALETTE.length
  ]

/**
 * 設問の組の類型（並び順のまま）。組が選ばれていない・見つからないときは空
 * （画面は「類型の組が選ばれていません」と知らせる）
 */
export function findScaleLevels(
  scoreScales: readonly (Pick<ScoreScaleRow, "id"> & {
    levels: readonly ScaleLevelChoice[]
  })[],
  scoreScaleId: string | null
): readonly ScaleLevelChoice[] {
  if (scoreScaleId === null) return []
  return (
    scoreScales.find((scoreScale) => scoreScale.id === scoreScaleId)?.levels ??
    []
  )
}

/** 数字キー（"1"〜"9"）が選ぶ類型。1 が先頭。0・小数点・類型の数を超える数字は何も選ばない */
export function scaleLevelOfDigit(
  scaleLevels: readonly ScaleLevelChoice[],
  key: string
): ScaleLevelChoice | null {
  if (!/^[1-9]$/.test(key)) return null
  return scaleLevels[Number(key) - 1] ?? null
}

/**
 * 一覧のマスの類型の見せ方。
 *
 * - `level`: 類型を付けたマス。類型の記号・点数と、並び順の色で出す
 * - `incompatible`: 方式と合わない採点（類型評価の設問の正答・誤答・部分点、点の採点の設問の
 *   評価済み）。得点にしないことを示す
 */
export type ScaleCellAppearance =
  | {
      kind: "level"
      label: string
      score: number
      colors: ScaleLevelColors
    }
  | { kind: "incompatible" }

/**
 * マスを類型の見せ方で出すなら、その見せ方。採点状態の見せ方のままでよいマスは null
 * （類型が消えた評価済みも、評価済みの既定の見せ方に任せる）
 */
export function scaleCellAppearanceOf({
  scoringMethod,
  status,
  scaleLevelId,
  scaleLevels,
}: {
  scoringMethod: ScoringMethod
  status: ScoringStatus
  scaleLevelId: string | null
  scaleLevels: readonly ScaleLevelChoice[]
}): ScaleCellAppearance | null {
  if (!isStatusCompatibleWithScoringMethod(scoringMethod, status)) {
    return { kind: "incompatible" }
  }
  if (status !== "evaluated" || scaleLevelId === null) return null
  const order = scaleLevels.findIndex(
    (scaleLevel) => scaleLevel.id === scaleLevelId
  )
  if (order < 0) return null
  const scaleLevel = scaleLevels[order]
  return {
    kind: "level",
    label: scaleLevel.label,
    score: scaleLevel.score,
    colors: scaleLevelColorsAt(order),
  }
}

/**
 * 採点の口（`handleBatchScore` の形）に渡された状態。新しい形（第1引数が状態）と
 * 旧い形（第1引数が答案 id・第2引数が状態）のどちらでも読む。状態が無ければ null
 */
export function scoringStatusOfCall(
  statusOrAnswerIds: ScoringStatus | string | string[],
  statusOrPartialScore?: ScoringStatus | number | null
): ScoringStatus | null {
  if (
    typeof statusOrAnswerIds === "string" &&
    isScoringStatus(statusOrAnswerIds)
  ) {
    return statusOrAnswerIds
  }
  return typeof statusOrPartialScore === "string" &&
    isScoringStatus(statusOrPartialScore)
    ? statusOrPartialScore
    : null
}
