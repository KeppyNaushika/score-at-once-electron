"use client"

import {
  describeCellPath,
  describePlacement,
  type PagePlacement,
  placementLabel,
} from "./pagePlacements"
import PaperPositionFigure from "./PaperPositionFigure"

interface PlacementBadgeProps {
  placement: PagePlacement
}

/**
 * 出力の何ページ目かを示すバッジ（プレビューのカードの右上）。
 *
 * 面に入るページは、出力用紙のどこに来るかを図で添える（全体 N-up で入れ子になっても、
 * 出力用紙の上の位置で見せる）。カード（`@container`）が狭いと図は隠し、番号だけを
 * 折り返さずに出す。位置は title で読める
 */
export default function PlacementBadge({ placement }: PlacementBadgeProps) {
  return (
    <div
      className="absolute top-1 right-1 flex items-center gap-1 rounded-full bg-primary px-1 py-0.5 text-[10px] font-medium whitespace-nowrap text-primary-foreground @min-[72px]:px-1.5"
      title={describePlacement(placement)}
    >
      {placement.paperFigure && placement.cellPath && (
        <span className="hidden @min-[72px]:contents">
          <PaperPositionFigure
            figure={placement.paperFigure}
            label={describeCellPath(placement.cellPath)}
          />
        </span>
      )}
      {placementLabel(placement)}
    </div>
  )
}
