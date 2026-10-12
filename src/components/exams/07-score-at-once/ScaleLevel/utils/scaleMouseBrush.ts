/**
 * 07 のマウスモードの採点ブラシを、今の設問の方式に合わせて読む（docs/vlm-grading-design.md §4-8-6）。
 *
 * 選んだブラシ（利用者の状態）は書き換えず、設問ごとに「効くブラシ」を読み替える。
 * 点の採点の設問へ戻れば、選んでいた正答などのブラシがそのまま戻る
 */

import type { MouseBrushAction } from "@/components/exams/07-score-at-once/types"
import { isStatusCompatibleWithScoringMethod } from "@/types/rubric.types"

import type { ScaleLevelChoice } from "./scaleLevelAppearance"

/** 効くブラシ。類型のブラシのときだけ、どの類型かを持つ */
export interface EffectiveMouseBrush {
  mouseBrush: MouseBrushAction
  mouseScaleLevelId: string | null
}

const SELECT_BRUSH: EffectiveMouseBrush = {
  mouseBrush: "select",
  mouseScaleLevelId: null,
}

/**
 * 今の設問で効くブラシ。効かないブラシは「選択」として読む（クリックで何も書かない）。
 *
 * - 類型のブラシは、類型方式の設問で、その類型が今の設問の類型表にあるときだけ効く
 *   （点の採点の設問・別の類型表の設問・類型が消えたときに、古い類型を書かない）
 * - 類型方式の設問では、正答・誤答・部分点・部分点入力のブラシは効かない（保留・無答・Wマークは効く）
 */
export function effectiveMouseBrushOf({
  mouseBrush,
  mouseScaleLevelId,
  isScaleQuestion,
  scaleLevels,
}: {
  mouseBrush: MouseBrushAction
  mouseScaleLevelId: string | null
  isScaleQuestion: boolean
  scaleLevels: readonly ScaleLevelChoice[]
}): EffectiveMouseBrush {
  if (mouseBrush === "scale_level") {
    const hasScaleLevel =
      isScaleQuestion &&
      scaleLevels.some((scaleLevel) => scaleLevel.id === mouseScaleLevelId)
    return hasScaleLevel ? { mouseBrush, mouseScaleLevelId } : SELECT_BRUSH
  }
  if (isScaleQuestion && !isMouseBrushCompatibleWithScale(mouseBrush)) {
    return SELECT_BRUSH
  }
  return { mouseBrush, mouseScaleLevelId: null }
}

/** 類型方式の設問に並べてよいブラシか（選択と、類型方式と合う採点状態。部分点入力は合わない） */
export function isMouseBrushCompatibleWithScale(
  mouseBrush: MouseBrushAction
): boolean {
  if (mouseBrush === "select" || mouseBrush === "scale_level") return true
  if (mouseBrush === "partial_modal") return false
  return isStatusCompatibleWithScoringMethod("scale", mouseBrush)
}
