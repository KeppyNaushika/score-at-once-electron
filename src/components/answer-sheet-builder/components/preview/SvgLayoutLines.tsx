"use client"

import type { BorderConfig } from "@/types/answerSheetDefinition.types"
import type { ComputedLine, DragInfo } from "@/types/answerSheetLayout.types"

import { DEFAULT_DASH_RATIO, DEFAULT_GAP_RATIO } from "../../constants"
import { getLineDashRatio } from "../../hooks/layout/layoutUtils"
import { getDashProps, isDragInfoEqual } from "./svgRenderUtils"

interface SvgLayoutLinesProps {
  lines: ComputedLine[]
  interactive?: boolean
  hoveredDragInfo?: DragInfo | null
  /** 罫線種別ごとの破線ダッシュ長/間隔の解決に使う。未指定時は既定倍率 */
  borderConfig?: BorderConfig
}

/** 罫線と、インタラクティブモードでドラッグをつかむ当たり判定を描く */
export function SvgLayoutLines({
  lines,
  interactive,
  hoveredDragInfo,
  borderConfig,
}: SvgLayoutLinesProps) {
  return (
    <>
      {lines.map((line, i) => {
        const isHovered =
          interactive && isDragInfoEqual(line.dragInfo, hoveredDragInfo)
        const sw = line.strokeWidth ?? (line.lineType === "outer" ? 0.7 : 0.4)
        const len = Math.hypot(line.x2 - line.x1, line.y2 - line.y1)
        const { dashRatio, gapRatio } = borderConfig
          ? getLineDashRatio(line.lineType, borderConfig)
          : { dashRatio: DEFAULT_DASH_RATIO, gapRatio: DEFAULT_GAP_RATIO }
        const dashProps = getDashProps(line.style, sw, len, dashRatio, gapRatio)
        return (
          <g key={`line-${i}`}>
            <line
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={isHovered ? "#3b82f6" : "black"}
              strokeWidth={isHovered ? 1 : sw}
              {...dashProps}
            />
            {/* インタラクティブモードのヒットエリア */}
            {interactive && line.dragInfo && (
              <rect
                x={
                  line.dragInfo.axis === "vertical"
                    ? line.x1 - 1
                    : Math.min(line.x1, line.x2)
                }
                y={
                  line.dragInfo.axis === "horizontal"
                    ? line.y1 - 1
                    : Math.min(line.y1, line.y2)
                }
                width={
                  line.dragInfo.axis === "vertical"
                    ? 2
                    : Math.abs(line.x2 - line.x1)
                }
                height={
                  line.dragInfo.axis === "horizontal"
                    ? 2
                    : Math.abs(line.y2 - line.y1)
                }
                fill="transparent"
                style={{ pointerEvents: "all" }}
              />
            )}
          </g>
        )
      })}
    </>
  )
}
