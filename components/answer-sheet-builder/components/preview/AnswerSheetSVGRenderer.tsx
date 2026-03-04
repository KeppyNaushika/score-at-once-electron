"use client"

import type { InlineSegment } from "@/lib/answer-sheet-builder/inlineMarkupParser"
import { parseInlineMarkup } from "@/lib/answer-sheet-builder/inlineMarkupParser"
import type { RenderMode } from "@/types/answerSheetDefinition.types"
import type {
  ComputedLayout,
  ComputedPageLayout,
  DragInfo,
} from "@/types/answerSheetLayout.types"

import {
  getDashProps,
  isDragInfoEqual,
  renderSegmentsHtml,
  renderSegmentsTspan,
} from "./svgRenderUtils"

interface AnswerSheetSVGRendererProps {
  layout: ComputedLayout
  /** 単一ページデータ（指定時はlayoutのcells/lines等より優先） */
  pageLayout?: ComputedPageLayout
  renderMode: RenderMode
  interactive?: boolean
  hoveredDragInfo?: DragInfo | null
}

/**
 * 解答用紙のSVG描画コンポーネント。
 * セル・罫線・番号ラベル・OMRマーカー・原稿用紙グリッドを描画する。
 */
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
  const headerFields = pageLayout?.headerFields ?? layout.headerFields

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

      {/* ヘッダー記入欄 */}
      {headerFields?.map((field) => {
        // hfill はスペーサーなので描画しない
        if (field.type === "hfill") return null

        // label タイプ: ボックスなしのテキスト表示
        if (field.type === "label") {
          return (
            <text
              key={`hf-${field.fieldId}`}
              x={field.x + field.width / 2}
              y={field.y + field.height / 2}
              fontSize={field.fontSize ?? 5}
              fontFamily="'Noto Sans JP', sans-serif"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#333"
            >
              {field.label}
            </text>
          )
        }

        // field タイプ: ボックス + ラベル + マス目
        const dashProps = getDashProps(field.lineStyle, field.lineWidth, 0)
        return (
          <g key={`hf-${field.fieldId}`}>
            {/* 外枠 */}
            <rect
              x={field.x}
              y={field.y}
              width={field.width}
              height={field.height}
              fill="none"
              stroke="black"
              strokeWidth={field.lineWidth}
              {...dashProps}
            />
            {/* ラベル */}
            <text
              x={field.x + field.width / 2}
              y={field.y - 1}
              fontSize={3}
              fontFamily="'Noto Sans JP', sans-serif"
              textAnchor="middle"
              dominantBaseline="auto"
              fill="#333"
            >
              {field.label}
            </text>
            {/* マス目線 */}
            {field.gridCount > 0 &&
              field.gridCellWidthMm &&
              Array.from({ length: field.gridCount - 1 }, (_, gi) => (
                <line
                  key={`hf-grid-${field.fieldId}-${gi}`}
                  x1={field.x + (gi + 1) * field.gridCellWidthMm!}
                  y1={field.y}
                  x2={field.x + (gi + 1) * field.gridCellWidthMm!}
                  y2={field.y + field.height}
                  stroke="#999"
                  strokeWidth={0.2}
                />
              ))}
          </g>
        )
      })}

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
      {numberLabels.map((label, i) => (
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
      ))}

      {/* セル内テキスト要素（インラインマークアップ対応） */}
      {cells
        .filter((c) => c.cellType === "answer")
        .flatMap((cell) => {
          // 原稿用紙セル: 字埋めレンダリング
          if (cell.manuscriptGrid) {
            const g = cell.manuscriptGrid
            const fontSize = g.cellSizeMm * 0.8
            // 全テキスト要素のセグメントをフラット化して1文字ずつに分解
            const chars: { char: string; seg: InlineSegment }[] = []
            for (const te of cell.textElements) {
              const segments = parseInlineMarkup(te.text)
              for (const seg of segments) {
                if (seg.modelAnswer && renderMode !== "model-answer") continue
                for (const ch of seg.text) {
                  chars.push({ char: ch, seg })
                }
              }
            }
            return chars
              .map(({ char, seg }, ci) => {
                const col = ci % g.columns
                const row = Math.floor(ci / g.columns)
                if (row >= g.rows) return null
                const cx = g.gridX + col * g.cellSizeMm + g.cellSizeMm / 2
                const cy = g.gridY + row * g.cellSizeMm + g.cellSizeMm / 2
                return (
                  <text
                    key={`mc-${cell.label}-${ci}`}
                    x={cx}
                    y={cy}
                    fontSize={fontSize}
                    fontFamily="'Noto Sans JP', sans-serif"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={
                      seg.modelAnswer
                        ? renderMode === "model-answer"
                          ? "#d00"
                          : "transparent"
                        : "#000"
                    }
                    fontWeight={seg.bold ? "bold" : undefined}
                    fontStyle={seg.italic ? "italic" : undefined}
                    textDecoration={
                      seg.strikethrough && seg.underline
                        ? "line-through underline"
                        : seg.strikethrough
                          ? "line-through"
                          : seg.underline
                            ? "underline"
                            : undefined
                    }
                  >
                    {char}
                  </text>
                )
              })
              .filter(Boolean)
          }

          // 通常セル
          return cell.textElements.map((te, ti) => {
            const segments = parseInlineMarkup(te.text)
            const hasMath = segments.some((s) => s.math)
            const hasNewline = te.text.includes("\n")

            // foreignObject: 数式 or 改行テキスト
            if (hasMath || hasNewline) {
              const textLines = te.text.split("\n")

              return (
                <foreignObject
                  key={`te-${cell.label}-${ti}`}
                  x={cell.x + 1}
                  y={cell.y + 1}
                  width={cell.width - 2}
                  height={cell.height - 2}
                >
                  <div
                    style={{
                      fontSize: `${te.fontSize}px`,
                      fontFamily: "'Noto Sans JP', sans-serif",
                      textAlign:
                        te.horizontalAlign === "left"
                          ? "left"
                          : te.horizontalAlign === "right"
                            ? "right"
                            : "center",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent:
                        te.verticalAlign === "top"
                          ? "flex-start"
                          : te.verticalAlign === "bottom"
                            ? "flex-end"
                            : "center",
                      height: "100%",
                    }}
                  >
                    {textLines.map((line, li) => (
                      <div key={li}>
                        {renderSegmentsHtml(
                          parseInlineMarkup(line),
                          renderMode,
                          te.fontSize
                        )}
                      </div>
                    ))}
                  </div>
                </foreignObject>
              )
            }

            // 単一行テキスト（math含むテキストは上のforeignObjectパスで処理済み）
            const tx =
              te.horizontalAlign === "left"
                ? cell.x + 2
                : te.horizontalAlign === "right"
                  ? cell.x + cell.width - 2
                  : cell.x + cell.width / 2
            const ty =
              te.verticalAlign === "top"
                ? cell.y + te.fontSize / 2 + 1
                : te.verticalAlign === "bottom"
                  ? cell.y + cell.height - te.fontSize / 2 - 1
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
                fontFamily="'Noto Sans JP', sans-serif"
                textAnchor={anchor}
                dominantBaseline="central"
                fill="#000"
              >
                {renderSegmentsTspan(segments, renderMode)}
              </text>
            )
          })
        })}

      {/* 画像要素 */}
      {cells
        .filter((c) => c.cellType === "answer" && c.imageElements?.length)
        .flatMap((cell) =>
          cell.imageElements!.map((ie, ii) => {
            const pad = 1
            const ix = cell.x + pad
            const iy = cell.y + pad
            const iw = cell.width - pad * 2
            const ih = cell.height - pad * 2
            const par =
              ie.objectFit === "contain"
                ? "xMidYMid meet"
                : ie.objectFit === "cover"
                  ? "xMidYMid slice"
                  : "none"
            return (
              <image
                key={`img-${cell.label}-${ii}`}
                href={`appimg:///${ie.imagePath}`}
                x={ix}
                y={iy}
                width={iw}
                height={ih}
                preserveAspectRatio={par}
                opacity={ie.opacity}
              />
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
