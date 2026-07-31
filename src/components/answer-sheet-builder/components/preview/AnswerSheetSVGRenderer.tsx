"use client"

import type { InlineSegment } from "@/lib/answer-sheet-builder/inlineMarkupParser"
import { parseInlineMarkup } from "@/lib/answer-sheet-builder/inlineMarkupParser"
import type {
  BorderConfig,
  BorderLineStyle,
  RenderMode,
} from "@/types/answerSheetDefinition.types"
import type {
  ComputedLayout,
  ComputedPageLayout,
  DragInfo,
} from "@/types/answerSheetLayout.types"

import {
  DEFAULT_DASH_RATIO,
  DEFAULT_GAP_RATIO,
  DEFAULT_MANUSCRIPT_BOUNDARY_WIDTH,
} from "../../constants"
import {
  getLineDashRatio,
  manuscriptCharPosition,
} from "../../hooks/layout/layoutUtils"
import {
  getDashProps,
  isDragInfoEqual,
  renderSegmentsHtml,
  renderSegmentsHtmlForPrint,
  renderSegmentsTspan,
} from "./svgRenderUtils"
import { verticalGlyphAdjust } from "./verticalGlyph"

interface AnswerSheetSVGRendererProps {
  layout: ComputedLayout
  /** 単一ページデータ（指定時はlayoutのcells/lines等より優先） */
  pageLayout?: ComputedPageLayout
  renderMode: RenderMode
  interactive?: boolean
  hoveredDragInfo?: DragInfo | null
  /** 印刷用モード: MathJaxデリミタ出力、appimg→file変換等 */
  forPrint?: boolean
  /** 印刷用: 画像パス → data URI のマップ */
  imageDataUris?: Map<string, string>
  /** 罫線種別ごとの破線ダッシュ長/間隔の解決に使う。未指定時は既定倍率 */
  borderConfig?: BorderConfig
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
  forPrint,
  imageDataUris,
  borderConfig,
}: AnswerSheetSVGRendererProps) {
  const { pageWidthMm, pageHeightMm } = layout
  // pageLayoutが指定されている場合はそちらのデータを使用
  const cells = pageLayout?.cells ?? layout.cells
  const lines = pageLayout?.lines ?? layout.lines
  const numberLabels = pageLayout?.numberLabels ?? layout.numberLabels
  const omrMarkerPositions =
    pageLayout?.omrMarkerPositions ?? layout.omrMarkerPositions
  const headerFields = pageLayout?.headerFields ?? layout.headerFields
  // 縦書きレイアウトか（テキストの描画方向に使う）
  const vertical = (pageLayout ?? layout).vertical ?? false

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
          const fLabelSize = field.fontSize ?? 5
          // 縦書き: foreignObject + writing-mode（番号ラベルと同方式）
          if (vertical) {
            return (
              <foreignObject
                key={`hf-${field.fieldId}`}
                x={field.x}
                y={field.y}
                width={field.width}
                height={field.height}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    writingMode: "vertical-rl",
                    fontSize: `${fLabelSize}px`,
                    fontFamily: "'Noto Sans JP', sans-serif",
                    color: "#333",
                    lineHeight: 1,
                  }}
                >
                  {field.label}
                </div>
              </foreignObject>
            )
          }
          return (
            <text
              key={`hf-${field.fieldId}`}
              x={field.x + field.width / 2}
              y={field.y + field.height / 2}
              fontSize={fLabelSize}
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

      {/* 番号ラベル（横書き） */}
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
        .filter((cell) => cell.cellType === "answer")
        .flatMap((cell, cellIdx) => {
          // 原稿用紙セル: 字埋めレンダリング
          if (cell.manuscriptGrid) {
            const manuscriptGrid = cell.manuscriptGrid
            const fontSize = manuscriptGrid.cellSizeMm * 0.8
            // 全テキスト要素のセグメントをフラット化して1文字ずつに分解
            const chars: { char: string; seg: InlineSegment }[] = []
            for (const textElement of cell.textElements) {
              const segments = parseInlineMarkup(textElement.text)
              for (const segment of segments) {
                // 模範解答セグメントもマス位置は確保する（空送り）。
                // 非表示時は下の fill="transparent" で見えなくするだけにし、
                // スキップして後続文字を詰めない。
                for (const char of segment.text) {
                  chars.push({ char, seg: segment })
                }
              }
            }
            return chars
              .map(({ char, seg }, ci) => {
                const pos = manuscriptCharPosition(
                  ci,
                  manuscriptGrid.columns,
                  manuscriptGrid.rows,
                  manuscriptGrid.vertical
                )
                if (!pos) return null
                const { col, row } = pos
                const cellCx =
                  manuscriptGrid.gridX +
                  col * manuscriptGrid.cellSizeMm +
                  manuscriptGrid.cellSizeMm / 2
                const cellCy =
                  manuscriptGrid.gridY +
                  row * manuscriptGrid.cellSizeMm +
                  manuscriptGrid.cellSizeMm / 2
                // 縦書きのみ約物の回転・右上寄せを適用
                const adjustment = manuscriptGrid.vertical
                  ? verticalGlyphAdjust(char)
                  : { rotate: 0, dxRatio: 0, dyRatio: 0 }
                const cx =
                  cellCx + adjustment.dxRatio * manuscriptGrid.cellSizeMm
                const cy =
                  cellCy + adjustment.dyRatio * manuscriptGrid.cellSizeMm
                return (
                  <text
                    key={`mc-${cellIdx}-${cell.label}-${ci}`}
                    x={cx}
                    y={cy}
                    transform={
                      adjustment.rotate
                        ? `rotate(${adjustment.rotate} ${cx} ${cy})`
                        : undefined
                    }
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
          return cell.textElements.map((textElement, ti) => {
            const segments = parseInlineMarkup(textElement.text)
            const hasMath = segments.some((segment) => segment.math)
            const hasNewline = textElement.text.includes("\n")

            // 縦書き: foreignObject + writing-mode:vertical-rl 方式（デバッグで縦書き実証済み）。
            // インラインマークアップ（太字/斜体/模範解答色）も renderSegmentsHtml で保持する。
            // 括弧回転・拗促音/句読点はブラウザの縦書きエンジンが処理する。
            if (vertical) {
              return (
                <foreignObject
                  key={`te-${cellIdx}-${cell.label}-${ti}`}
                  x={cell.x + 1}
                  y={cell.y + 1}
                  width={cell.width - 2}
                  height={cell.height - 2}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      writingMode: "vertical-rl",
                      fontSize: `${textElement.fontSize}px`,
                      fontFamily: "'Noto Sans JP', sans-serif",
                      color: "#000",
                      lineHeight: 1,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {forPrint
                      ? renderSegmentsHtmlForPrint(segments, renderMode)
                      : renderSegmentsHtml(
                          segments,
                          renderMode,
                          textElement.fontSize
                        )}
                  </div>
                </foreignObject>
              )
            }

            // foreignObject: 数式 or 改行テキスト
            if (hasMath || hasNewline) {
              const textLines = textElement.text.split("\n")

              return (
                <foreignObject
                  key={`te-${cellIdx}-${cell.label}-${ti}`}
                  x={cell.x + 1}
                  y={cell.y + 1}
                  width={cell.width - 2}
                  height={cell.height - 2}
                >
                  <div
                    style={{
                      fontSize: `${textElement.fontSize}px`,
                      fontFamily: "'Noto Sans JP', sans-serif",
                      textAlign:
                        textElement.horizontalAlign === "left"
                          ? "left"
                          : textElement.horizontalAlign === "right"
                            ? "right"
                            : "center",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent:
                        textElement.verticalAlign === "top"
                          ? "flex-start"
                          : textElement.verticalAlign === "bottom"
                            ? "flex-end"
                            : "center",
                      height: "100%",
                    }}
                  >
                    {textLines.map((line, li) => (
                      <div key={li}>
                        {forPrint
                          ? renderSegmentsHtmlForPrint(
                              parseInlineMarkup(line),
                              renderMode
                            )
                          : renderSegmentsHtml(
                              parseInlineMarkup(line),
                              renderMode,
                              textElement.fontSize
                            )}
                      </div>
                    ))}
                  </div>
                </foreignObject>
              )
            }

            // 単一行テキスト（math含むテキストは上のforeignObjectパスで処理済み）
            const tx =
              textElement.horizontalAlign === "left"
                ? cell.x + 2
                : textElement.horizontalAlign === "right"
                  ? cell.x + cell.width - 2
                  : cell.x + cell.width / 2
            const ty =
              textElement.verticalAlign === "top"
                ? cell.y + textElement.fontSize / 2 + 1
                : textElement.verticalAlign === "bottom"
                  ? cell.y + cell.height - textElement.fontSize / 2 - 1
                  : cell.y + cell.height / 2
            const anchor =
              textElement.horizontalAlign === "left"
                ? "start"
                : textElement.horizontalAlign === "right"
                  ? "end"
                  : "middle"

            return (
              <text
                key={`te-${cellIdx}-${cell.label}-${ti}`}
                x={tx}
                y={ty}
                fontSize={textElement.fontSize}
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
        .filter(
          (cell) => cell.cellType === "answer" && cell.imageElements?.length
        )
        .flatMap((cell, cellIdx) =>
          cell
            .imageElements!.filter((imageElement) => {
              const visibility = imageElement.visibility ?? "both"
              if (visibility === "both") return true
              if (visibility === "answer-sheet-only")
                return renderMode === "answer-sheet"
              if (visibility === "model-answer-only")
                return renderMode === "model-answer"
              return true
            })
            .map((imageElement, ii) => {
              const pad = 1
              const ix = cell.x + pad
              const iy = cell.y + pad
              const iw = cell.width - pad * 2
              const ih = cell.height - pad * 2
              const par =
                imageElement.objectFit === "contain"
                  ? "xMidYMid meet"
                  : imageElement.objectFit === "cover"
                    ? "xMidYMid slice"
                    : "none"
              const href =
                forPrint && imageDataUris?.has(imageElement.imagePath)
                  ? imageDataUris.get(imageElement.imagePath)!
                  : `appimg:///${imageElement.imagePath}`
              return (
                <image
                  key={`img-${cellIdx}-${cell.label}-${ii}`}
                  href={href}
                  x={ix}
                  y={iy}
                  width={iw}
                  height={ih}
                  preserveAspectRatio={par}
                  opacity={imageElement.opacity}
                />
              )
            })
        )}

      {/* OMRバブル（共通テスト準拠：楕円＋内部ラベル） */}
      {cells
        .filter((cell) => cell.cellType === "answer" && cell.omrBubbles?.length)
        .flatMap((cell, cellIdx) =>
          cell.omrBubbles!.map((bubble, bi) => {
            const cx = bubble.normalizedCx * pageWidthMm
            const cy = bubble.normalizedCy * pageHeightMm
            const rx = (bubble.normalizedWidth * pageWidthMm) / 2
            const ry = (bubble.normalizedHeight * pageHeightMm) / 2
            return (
              <g key={`omr-bubble-${cellIdx}-${cell.label}-${bi}`}>
                <ellipse
                  cx={cx}
                  cy={cy}
                  rx={rx}
                  ry={ry}
                  fill="none"
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
                  fill="#333"
                >
                  {bubble.label}
                </text>
              </g>
            )
          })
        )}

      {/* 原稿用紙グリッド */}
      {cells
        .filter((cell) => cell.cellType === "answer" && cell.manuscriptGrid)
        .map((cell, cellIdx) => {
          const manuscriptGrid = cell.manuscriptGrid!
          // 縦線(col)/横線(row)への線種割当は書字方向で決まる。
          // 行方向（字間）= 縦書きなら横線・横書きなら縦線。輪転印刷でかすれぬよう黒。
          const colStyle = manuscriptGrid.vertical
            ? manuscriptGrid.lineDividerStyle
            : manuscriptGrid.charDividerStyle
          const colWidth = manuscriptGrid.vertical
            ? manuscriptGrid.lineDividerWidth
            : manuscriptGrid.charDividerWidth
          const rowStyle = manuscriptGrid.vertical
            ? manuscriptGrid.charDividerStyle
            : manuscriptGrid.lineDividerStyle
          const rowWidth = manuscriptGrid.vertical
            ? manuscriptGrid.charDividerWidth
            : manuscriptGrid.lineDividerWidth
          // 字間（char）/行間（line）罫線の破線倍率。縦書きは縦線=行間・横線=字間。
          const charDash = {
            dashRatio:
              borderConfig?.manuscriptCharDividerDashRatio ??
              DEFAULT_DASH_RATIO,
            gapRatio:
              borderConfig?.manuscriptCharDividerGapRatio ?? DEFAULT_GAP_RATIO,
          }
          const lineDash = {
            dashRatio:
              borderConfig?.manuscriptLineDividerDashRatio ??
              DEFAULT_DASH_RATIO,
            gapRatio:
              borderConfig?.manuscriptLineDividerGapRatio ?? DEFAULT_GAP_RATIO,
          }
          const colDash = manuscriptGrid.vertical ? lineDash : charDash
          const rowDash = manuscriptGrid.vertical ? charDash : lineDash
          const cellSize = manuscriptGrid.cellSizeMm
          // 区切り罫線を「置き換え」るため、どの内部罫線セグメントを差し替えるか先に収集。
          // 縦線セグメント: key `${ci}:${row}` / 横線セグメント: key `${ri}:${col}`
          type BoundarySpec = {
            style: BorderLineStyle
            width: number
            dashRatio: number
            gapRatio: number
          }
          const vOverride = new Map<string, BoundarySpec>()
          const hOverride = new Map<string, BoundarySpec>()
          for (const guide of manuscriptGrid.charGuides) {
            if (!guide.boundary) continue
            const pos = manuscriptCharPosition(
              guide.atChar - 1,
              manuscriptGrid.columns,
              manuscriptGrid.rows,
              manuscriptGrid.vertical
            )
            if (!pos) continue
            const bw = guide.boundaryWidth ?? DEFAULT_MANUSCRIPT_BOUNDARY_WIDTH
            const spec: BoundarySpec = {
              style: guide.boundary,
              width: bw,
              dashRatio: guide.boundaryDashRatio ?? DEFAULT_DASH_RATIO,
              gapRatio: guide.boundaryGapRatio ?? DEFAULT_GAP_RATIO,
            }
            // 行末（折り返し位置）は内部罫線が無く、置き換え対象は構造罫線
            // （小計/大問罫線）になるため、ここでは描画しない。
            if (manuscriptGrid.vertical) {
              // 縦書き: 文字は上→下。トレーリング側＝マス下辺（横罫線 ri=row+1）
              if (pos.row < manuscriptGrid.rows - 1) {
                hOverride.set(`${pos.row + 1}:${pos.col}`, spec)
              }
            } else {
              // 横書き: 文字は左→右。トレーリング側＝マス右辺（縦罫線 ci=col+1）
              if (pos.col < manuscriptGrid.columns - 1) {
                vOverride.set(`${pos.col + 1}:${pos.row}`, spec)
              }
            }
          }
          const gridLines: React.ReactNode[] = []
          // 縦罫線（内部）: 置き換え区間を除いて連続ランで描き、区間は境界線で差し替え
          for (let ci = 1; ci < manuscriptGrid.columns; ci++) {
            const x = manuscriptGrid.gridX + ci * cellSize
            const flushRun = (r0: number, r1: number) => {
              if (r1 <= r0) return
              gridLines.push(
                <line
                  key={`mg-v-${cellIdx}-${cell.label}-${ci}-${r0}`}
                  x1={x}
                  y1={manuscriptGrid.gridY + r0 * cellSize}
                  x2={x}
                  y2={manuscriptGrid.gridY + r1 * cellSize}
                  stroke="#000"
                  strokeWidth={colWidth}
                  {...getDashProps(
                    colStyle,
                    colWidth,
                    (r1 - r0) * cellSize,
                    colDash.dashRatio,
                    colDash.gapRatio
                  )}
                />
              )
            }
            let runStart = 0
            for (let row = 0; row < manuscriptGrid.rows; row++) {
              const override = vOverride.get(`${ci}:${row}`)
              if (!override) continue
              flushRun(runStart, row)
              gridLines.push(
                <line
                  key={`mg-vb-${cellIdx}-${cell.label}-${ci}-${row}`}
                  x1={x}
                  y1={manuscriptGrid.gridY + row * cellSize}
                  x2={x}
                  y2={manuscriptGrid.gridY + (row + 1) * cellSize}
                  stroke="#000"
                  strokeWidth={override.width}
                  {...getDashProps(
                    override.style,
                    override.width,
                    cellSize,
                    override.dashRatio,
                    override.gapRatio
                  )}
                />
              )
              runStart = row + 1
            }
            flushRun(runStart, manuscriptGrid.rows)
          }
          // 横罫線（内部）: 同様に置き換え区間を差し替え
          for (let ri = 1; ri < manuscriptGrid.rows; ri++) {
            const y = manuscriptGrid.gridY + ri * cellSize
            const flushRun = (c0: number, c1: number) => {
              if (c1 <= c0) return
              gridLines.push(
                <line
                  key={`mg-h-${cellIdx}-${cell.label}-${ri}-${c0}`}
                  x1={manuscriptGrid.gridX + c0 * cellSize}
                  y1={y}
                  x2={manuscriptGrid.gridX + c1 * cellSize}
                  y2={y}
                  stroke="#000"
                  strokeWidth={rowWidth}
                  {...getDashProps(
                    rowStyle,
                    rowWidth,
                    (c1 - c0) * cellSize,
                    rowDash.dashRatio,
                    rowDash.gapRatio
                  )}
                />
              )
            }
            let runStart = 0
            for (let col = 0; col < manuscriptGrid.columns; col++) {
              const override = hOverride.get(`${ri}:${col}`)
              if (!override) continue
              flushRun(runStart, col)
              gridLines.push(
                <line
                  key={`mg-hb-${cellIdx}-${cell.label}-${ri}-${col}`}
                  x1={manuscriptGrid.gridX + col * cellSize}
                  y1={y}
                  x2={manuscriptGrid.gridX + (col + 1) * cellSize}
                  y2={y}
                  stroke="#000"
                  strokeWidth={override.width}
                  {...getDashProps(
                    override.style,
                    override.width,
                    cellSize,
                    override.dashRatio,
                    override.gapRatio
                  )}
                />
              )
              runStart = col + 1
            }
            flushRun(runStart, manuscriptGrid.columns)
          }
          // 数字ガイド: 先頭からN文字目のマスの隅に小さく表示（空ラベルは描かない）
          const guides: React.ReactNode[] = []
          for (let gi = 0; gi < manuscriptGrid.charGuides.length; gi++) {
            const guide = manuscriptGrid.charGuides[gi]
            if (!guide.label) continue
            const pos = manuscriptCharPosition(
              guide.atChar - 1,
              manuscriptGrid.columns,
              manuscriptGrid.rows,
              manuscriptGrid.vertical
            )
            if (!pos) continue
            const fs = manuscriptGrid.guideFontSize
            const cellX0 = manuscriptGrid.gridX + pos.col * cellSize
            const cellY0 = manuscriptGrid.gridY + pos.row * cellSize
            const left = manuscriptGrid.guidePosition.endsWith("left")
            const top = manuscriptGrid.guidePosition.startsWith("top")
            // アンカー点 = マスの該当隅から余白分だけ内側へ
            const gpad = manuscriptGrid.guidePadding
            const px = left ? cellX0 + gpad : cellX0 + cellSize - gpad
            const py = top ? cellY0 + gpad : cellY0 + cellSize - gpad
            guides.push(
              <text
                key={`mguide-${cellIdx}-${cell.label}-${gi}`}
                x={px}
                y={py}
                fontSize={fs}
                fontFamily="'Noto Sans JP', sans-serif"
                textAnchor={left ? "start" : "end"}
                dominantBaseline={top ? "text-before-edge" : "text-after-edge"}
                fill="#000"
              >
                {guide.label}
              </text>
            )
          }
          return (
            <g key={`mg-${cellIdx}-${cell.label}`}>
              {gridLines}
              {guides}
            </g>
          )
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
