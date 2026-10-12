import { TriangleAlert } from "lucide-react"

import { INCOMPATIBLE_SCORE_TITLE } from "./scaleLevelMessages"
import type { ScaleCellAppearance } from "./utils/scaleLevelAppearance"

/**
 * 一覧のマスの採点マークの位置に置く、類型の記号か「方式と合わない採点」の印
 * （docs/vlm-grading-design.md §4-8-5・§4-8-8）
 */
export function ScaleCellMark({
  appearance,
}: {
  appearance: ScaleCellAppearance
}) {
  if (appearance.kind === "incompatible") {
    return (
      <span
        title={INCOMPATIBLE_SCORE_TITLE}
        aria-label={INCOMPATIBLE_SCORE_TITLE}
        role="img"
        className="inline-flex"
      >
        <TriangleAlert className="h-3 w-3 shrink-0 text-amber-600" />
      </span>
    )
  }
  return (
    <span
      className="text-xs leading-none font-bold"
      style={{ color: appearance.colors.text }}
      title={`類型 ${appearance.label}（${appearance.score}点）`}
    >
      {appearance.label}
    </span>
  )
}
