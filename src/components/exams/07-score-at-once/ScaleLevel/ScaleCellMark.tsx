import type { ScaleCellAppearance } from "./utils/scaleLevelAppearance"

/**
 * 一覧のマスの採点マークの位置に置く、類型の記号（docs/vlm-grading-design.md §4-8-5）
 */
export function ScaleCellMark({
  appearance,
}: {
  appearance: ScaleCellAppearance
}) {
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
