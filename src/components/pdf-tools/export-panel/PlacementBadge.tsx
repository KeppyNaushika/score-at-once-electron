"use client"

import {
  describePlacement,
  type PagePlacement,
  placementLabel,
} from "./pagePlacements"
import SheetCellFigure from "./SheetCellFigure"

interface PlacementBadgeProps {
  placement: PagePlacement
}

/**
 * 出力の何ページ目かを示すバッジ（プレビューのカードの右上）。
 *
 * 面に入るページは、面の格子のどのマスに入るかを図で添える。カード（`@container`）が
 * 狭いと図は隠し、番号だけを折り返さずに出す。位置は title で読める
 */
export default function PlacementBadge({ placement }: PlacementBadgeProps) {
  return (
    <div
      className="absolute top-1 right-1 flex items-center gap-1 rounded-full bg-primary px-1 py-0.5 text-[10px] font-medium whitespace-nowrap text-primary-foreground @min-[72px]:px-1.5"
      title={describePlacement(placement)}
    >
      {placement.cell && (
        <span className="hidden @min-[72px]:contents">
          <SheetCellFigure cell={placement.cell} />
        </span>
      )}
      {placementLabel(placement)}
    </div>
  )
}
