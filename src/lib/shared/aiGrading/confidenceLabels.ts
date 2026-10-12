/**
 * AI が判定に付ける確信度の呼び名。画面（07 の AI採点）と、2段目へ送る文の両方がここを引く
 */

import type { AiGradingConfidence } from "@/types/aiGrading.types"

export const AI_GRADING_CONFIDENCE_LABELS: Readonly<
  Record<AiGradingConfidence, string>
> = {
  high: "高",
  medium: "中",
  low: "低",
}
