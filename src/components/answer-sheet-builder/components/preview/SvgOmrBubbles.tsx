"use client"

import type { RenderMode } from "@/types/answerSheetDefinition.types"
import type { ComputedCell } from "@/types/answerSheetLayout.types"

import { MODEL_ANSWER_COLOR } from "../../constants"

interface SvgOmrBubblesProps {
  cells: ComputedCell[]
  renderMode: RenderMode
  pageWidthMm: number
  pageHeightMm: number
}

/** OMRバブル（共通テスト準拠：楕円＋内部ラベル）を描く */
export function SvgOmrBubbles({
  cells,
  renderMode,
  pageWidthMm,
  pageHeightMm,
}: SvgOmrBubblesProps) {
  return (
    <>
      {cells
        .filter((cell) => cell.cellType === "answer" && cell.omrBubbles?.length)
        .flatMap((cell, cellIdx) =>
          cell.omrBubbles!.map((bubble, bi) => {
            const cx = bubble.normalizedCx * pageWidthMm
            const cy = bubble.normalizedCy * pageHeightMm
            const rx = (bubble.normalizedWidth * pageWidthMm) / 2
            const ry = (bubble.normalizedHeight * pageHeightMm) / 2
            // 模範解答では正解のバブルを塗りつぶす。枠は解答用紙と同じ黒のまま
            // （どこがバブルかの見え方を模範解答でも変えない）。文字は塗りの上でも
            // 読めるよう白抜き。
            const filled =
              renderMode === "model-answer" && bubble.isCorrectAnswer
            return (
              <g key={`omr-bubble-${cellIdx}-${cell.label}-${bi}`}>
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx={rx}
                  ry={ry}
                  fill={filled ? MODEL_ANSWER_COLOR : "none"}
                  stroke="black"
                  strokeWidth={0.3}
                />
                <text
                  x={cx}
                  y={cy}
                  fontSize={ry * 1.1}
                  fontFamily="'Noto Sans JP', sans-serif"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={filled ? "white" : "#333"}
                >
                  {bubble.label}
                </text>
              </g>
            )
          })
        )}
    </>
  )
}
