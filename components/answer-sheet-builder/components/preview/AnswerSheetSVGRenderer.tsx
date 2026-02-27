"use client"

import type {
  ComputedLayout,
  DragInfo,
  LineStyle,
  RenderMode,
} from "@/types/answerSheetBuilder.types"

interface AnswerSheetSVGRendererProps {
  layout: ComputedLayout
  renderMode: RenderMode
  interactive?: boolean
  hoveredDragInfo?: DragInfo | null
}

function getStrokeDashArray(style: LineStyle): string | undefined {
  switch (style) {
    case "dashed":
      return "4 2"
    case "dotted":
      return "1 2"
    default:
      return undefined
  }
}

function isDragInfoEqual(
  a: DragInfo | undefined,
  b: DragInfo | null | undefined
): boolean {
  if (!a || !b) return false
  if (a.axis !== b.axis) return false
  if (a.target.type !== b.target.type) return false
  if (
    a.target.type === "heightMultiplier" &&
    b.target.type === "heightMultiplier"
  ) {
    return (
      a.target.majorIndex === b.target.majorIndex &&
      a.target.subIndex === b.target.subIndex &&
      a.target.branchIndex === b.target.branchIndex
    )
  }
  if (a.target.type === "columnWidth" && b.target.type === "columnWidth") {
    return a.target.column === b.target.column
  }
  return false
}

export function AnswerSheetSVGRenderer({
  layout,
  renderMode,
  interactive,
  hoveredDragInfo,
}: AnswerSheetSVGRendererProps) {
  const {
    pageWidthMm,
    pageHeightMm,
    cells,
    lines,
    numberLabels,
    omrMarkerPositions,
  } = layout

  return (
    <>
      {/* 用紙背景 */}
      <rect width={pageWidthMm} height={pageHeightMm} fill="white" />

      {/* OMRマーカー */}
      {omrMarkerPositions.map((marker, i) => (
        <rect
          key={`omr-${i}`}
          x={marker.x}
          y={marker.y}
          width={marker.size}
          height={marker.size}
          fill="black"
        />
      ))}

      {/* 罫線 */}
      {lines.map((line, i) => {
        const isHovered =
          interactive && isDragInfoEqual(line.dragInfo, hoveredDragInfo)
        return (
          <g key={`line-${i}`}>
            <line
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={isHovered ? "#3b82f6" : "black"}
              strokeWidth={
                isHovered ? 1 : line.lineType === "outer" ? 0.7 : 0.4
              }
              strokeDasharray={getStrokeDashArray(line.style)}
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

      {/* 番号ラベル */}
      {numberLabels.map((label, i) => {
        // 横配置時の小問ラベル: セル内左側に配置
        if (label.displayMode === "sub-horizontal") {
          return (
            <text
              key={`label-${i}`}
              x={label.x + 1}
              y={label.y + label.height / 2}
              fontSize={label.fontSize}
              fontFamily="'Noto Sans JP', sans-serif"
              textAnchor="start"
              dominantBaseline="central"
              fill="#000"
            >
              {label.text}
            </text>
          )
        }
        return (
          <text
            key={`label-${i}`}
            x={label.x + label.width / 2}
            y={label.y + label.height / 2}
            fontSize={label.fontSize}
            fontFamily="'Noto Sans JP', sans-serif"
            textAnchor="middle"
            dominantBaseline="central"
            fill="#000"
          >
            {label.text}
          </text>
        )
      })}

      {/* 模範解答テキスト */}
      {renderMode === "model-answer" &&
        cells
          .filter((c) => c.cellType === "answer" && c.modelAnswer)
          .map((cell, i) => (
            <text
              key={`model-${i}`}
              x={cell.x + cell.width / 2}
              y={cell.y + cell.height / 2}
              fontSize={10}
              fontFamily="'Noto Sans JP', sans-serif"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#d00"
            >
              {cell.modelAnswer}
            </text>
          ))}

      {/* セル内テキスト要素 */}
      {cells
        .filter((c) => c.cellType === "answer")
        .flatMap((cell) =>
          cell.textElements.map((te, ti) => {
            const tx =
              te.horizontalAlign === "left"
                ? cell.x + 2
                : te.horizontalAlign === "right"
                  ? cell.x + cell.width - 2
                  : cell.x + cell.width / 2
            const ty =
              te.verticalAlign === "top"
                ? cell.y + te.fontSize * 0.4
                : te.verticalAlign === "bottom"
                  ? cell.y + cell.height - 2
                  : cell.y + cell.height / 2
            const anchor =
              te.horizontalAlign === "left"
                ? "start"
                : te.horizontalAlign === "right"
                  ? "end"
                  : "middle"

            return (
              <text
                key={`te-${cell.label}-${ti}`}
                x={tx}
                y={ty}
                fontSize={te.fontSize}
                fontWeight={te.fontWeight}
                fontFamily="'Noto Sans JP', sans-serif"
                textAnchor={anchor}
                dominantBaseline="central"
                fill="#000"
              >
                {te.text}
              </text>
            )
          })
        )}

      {/* 溢れ警告 */}
      {layout.overflow && (
        <g>
          <rect
            x={pageWidthMm / 2 - 40}
            y={pageHeightMm - 12}
            width={80}
            height={8}
            rx={2}
            fill="rgba(239,68,68,0.9)"
          />
          <text
            x={pageWidthMm / 2}
            y={pageHeightMm - 8}
            fontSize={4}
            fontFamily="sans-serif"
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
          >
            用紙サイズを超過しています
          </text>
        </g>
      )}
    </>
  )
}
