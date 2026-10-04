"use client"

import type { InlineSegment } from "@/lib/answer-sheet-builder/inlineMarkupParser"
import { parseInlineMarkup } from "@/lib/answer-sheet-builder/inlineMarkupParser"
import type { RenderMode } from "@/types/answerSheetDefinition.types"
import type { ComputedCell } from "@/types/answerSheetLayout.types"

import { MODEL_ANSWER_COLOR } from "../../constants"
import { manuscriptCharPosition } from "../../hooks/layout/layoutUtils"
import {
  renderSegmentsHtml,
  renderSegmentsHtmlForPrint,
  renderSegmentsTspan,
} from "./svgRenderUtils"
import { verticalGlyphAdjust } from "./verticalGlyph"

interface SvgCellTextElementsProps {
  cells: ComputedCell[]
  /** 縦書きレイアウトか（テキストの描画方向に使う） */
  vertical: boolean
  renderMode: RenderMode
  /** 印刷用モード: MathJaxデリミタ出力 */
  forPrint?: boolean
}

/**
 * セル内テキスト要素（インラインマークアップ対応）を描く。
 * 原稿用紙セルは1文字ずつマスに字埋めする。
 */
export function SvgCellTextElements({
  cells,
  vertical,
  renderMode,
  forPrint,
}: SvgCellTextElementsProps) {
  return (
    <>
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
                          ? MODEL_ANSWER_COLOR
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
    </>
  )
}
