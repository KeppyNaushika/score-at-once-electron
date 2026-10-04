"use client"

import type {
  BorderConfig,
  BorderLineStyle,
} from "@/types/answerSheetDefinition.types"
import type { ComputedCell } from "@/types/answerSheetLayout.types"

import {
  DEFAULT_DASH_RATIO,
  DEFAULT_GAP_RATIO,
  DEFAULT_MANUSCRIPT_BOUNDARY_WIDTH,
} from "../../constants"
import { manuscriptCharPosition } from "../../hooks/layout/layoutUtils"
import { getDashProps } from "./svgRenderUtils"

interface SvgManuscriptGridsProps {
  cells: ComputedCell[]
  /** 原稿用紙の字間・行間罫線の破線倍率の解決に使う。未指定時は既定倍率 */
  borderConfig?: BorderConfig
}

/**
 * 原稿用紙グリッドを描く。
 * 内部罫線・文字位置マーカーの区切り罫線（置き換え）・数字ガイド。
 */
export function SvgManuscriptGrids({
  cells,
  borderConfig,
}: SvgManuscriptGridsProps) {
  return (
    <>
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
    </>
  )
}
