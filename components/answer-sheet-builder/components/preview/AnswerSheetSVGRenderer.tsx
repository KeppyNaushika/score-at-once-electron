"use client"

import type {
  ComputedLayout,
  ComputedPageLayout,
  DragInfo,
  LineStyle,
  RenderMode,
} from "@/types/answerSheetBuilder.types"

interface AnswerSheetSVGRendererProps {
  layout: ComputedLayout
  /** 単一ページデータ（指定時はlayoutのcells/lines等より優先） */
  pageLayout?: ComputedPageLayout
  renderMode: RenderMode
  interactive?: boolean
  hoveredDragInfo?: DragInfo | null
}

function getDashProps(
  style: LineStyle,
  strokeWidth: number,
  lineLength: number
): {
  strokeDasharray?: string
  strokeDashoffset?: number
  strokeLinecap?: "round" | "butt"
} {
  let dash: number, gap: number
  switch (style) {
    case "dashed":
      dash = strokeWidth * 3
      gap = strokeWidth * 1
      break
    case "dotted":
      dash = 0.01
      gap = strokeWidth * 2
      break
    default:
      return {}
  }
  const period = dash + gap
  const offset = ((lineLength / 2) % period) - dash / 2
  return {
    strokeDasharray: `${dash} ${gap}`,
    strokeDashoffset: offset,
    strokeLinecap: "round",
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
  pageLayout,
  renderMode,
  interactive,
  hoveredDragInfo,
}: AnswerSheetSVGRendererProps) {
  const { pageWidthMm, pageHeightMm } = layout
  // pageLayoutが指定されている場合はそちらのデータを使用
  const cells = pageLayout?.cells ?? layout.cells
  const lines = pageLayout?.lines ?? layout.lines
  const numberLabels = pageLayout?.numberLabels ?? layout.numberLabels
  const omrMarkerPositions =
    pageLayout?.omrMarkerPositions ?? layout.omrMarkerPositions

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
        const sw = line.strokeWidth ?? (line.lineType === "outer" ? 0.7 : 0.4)
        const len = Math.hypot(line.x2 - line.x1, line.y2 - line.y1)
        const dashProps = getDashProps(line.style, sw, len)
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

      {/* 番号ラベル */}
      {numberLabels.map((label, i) => {
        // 横配置時の小問ラベル: セル内左側に配置
        if (
          label.displayMode === "sub-horizontal" ||
          label.displayMode === "branch-horizontal"
        ) {
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
                fontStyle={te.fontStyle === "italic" ? "italic" : undefined}
                textDecoration={
                  te.textDecoration === "line-through"
                    ? "line-through"
                    : undefined
                }
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

      {/* OMRバブル */}
      {cells
        .filter((c) => c.cellType === "answer" && c.omrBubbles?.length)
        .flatMap((cell) =>
          cell.omrBubbles!.map((bubble, bi) => {
            const cx = bubble.normalizedCx * pageWidthMm
            const cy = bubble.normalizedCy * pageHeightMm
            const r = bubble.normalizedRadius * pageWidthMm
            return (
              <g key={`omr-bubble-${cell.label}-${bi}`}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke="black"
                  strokeWidth={0.3}
                />
                <text
                  x={cx}
                  y={cy + r + 2}
                  fontSize={2.5}
                  fontFamily="'Noto Sans JP', sans-serif"
                  textAnchor="middle"
                  dominantBaseline="hanging"
                  fill="#333"
                >
                  {bubble.label}
                </text>
              </g>
            )
          })
        )}

      {/* OMR数字欄 */}
      {cells
        .filter((c) => c.cellType === "answer" && c.omrDigitBoxes?.length)
        .flatMap((cell) =>
          cell.omrDigitBoxes!.map((box, di) => {
            const x = box.normalizedX * pageWidthMm
            const y = box.normalizedY * pageHeightMm
            const w = box.normalizedW * pageWidthMm
            const h = box.normalizedH * pageHeightMm
            return (
              <rect
                key={`omr-digit-${cell.label}-${di}`}
                x={x}
                y={y}
                width={w}
                height={h}
                fill="none"
                stroke="#666"
                strokeWidth={0.3}
              />
            )
          })
        )}

      {/* 原稿用紙グリッド */}
      {cells
        .filter((c) => c.cellType === "answer" && c.manuscriptGrid)
        .map((cell) => {
          const g = cell.manuscriptGrid!
          const gridLines: React.ReactNode[] = []
          for (let col = 1; col < g.columns; col++) {
            const x = g.gridX + col * g.cellSizeMm
            gridLines.push(
              <line
                key={`mg-v-${cell.label}-${col}`}
                x1={x}
                y1={g.gridY}
                x2={x}
                y2={g.gridY + g.gridHeight}
                stroke="#ccc"
                strokeWidth={0.2}
              />
            )
          }
          for (let row = 1; row < g.rows; row++) {
            const y = g.gridY + row * g.cellSizeMm
            gridLines.push(
              <line
                key={`mg-h-${cell.label}-${row}`}
                x1={g.gridX}
                y1={y}
                x2={g.gridX + g.gridWidth}
                y2={y}
                stroke="#ccc"
                strokeWidth={0.2}
              />
            )
          }
          return <g key={`mg-${cell.label}`}>{gridLines}</g>
        })}

      {/* 溢れ警告（単一ページモード時のみ表示） */}
      {!pageLayout && layout.overflow && (
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
