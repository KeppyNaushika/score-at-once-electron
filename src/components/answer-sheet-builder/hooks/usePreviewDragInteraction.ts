/**
 * プレビュー上の罫線ドラッグによる微調整フック
 *
 * SVGプレビューの罫線をドラッグして行高さ・列幅を直接調整する。
 * ドラッグ情報はComputedLine.dragInfoから取得。
 */

import { useCallback, useRef, useState } from "react"

import type { AnswerSheetAction } from "@/types/answerSheetDefinition.types"
import type { ComputedLayout, DragInfo } from "@/types/answerSheetLayout.types"

const HIT_DISTANCE_PX = 6

interface DragState {
  dragInfo: DragInfo
  startClientX: number
  startClientY: number
  startValueMm: number
}

export interface PreviewDragResult {
  /** ホバー中の線のdragInfo */
  hoveredDragInfo: DragInfo | null
  /** SVG要素のマウスイベントハンドラ */
  onMouseDown: (e: React.MouseEvent<SVGSVGElement>) => void
  onMouseMove: (e: React.MouseEvent<SVGSVGElement>) => void
  onMouseUp: () => void
  onMouseLeave: () => void
  /** カーソルスタイル */
  cursor: string
}

export function usePreviewDragInteraction(
  layout: ComputedLayout,
  interactive: boolean,
  dispatch: (action: AnswerSheetAction) => void,
  baseRowHeight: number
): PreviewDragResult {
  const [hoveredDragInfo, setHoveredDragInfo] = useState<DragInfo | null>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const svgRectRef = useRef<DOMRect | null>(null)

  /** SVGピクセル座標からmm座標への変換係数を取得 */
  const getPxToMm = useCallback(
    (svg: SVGSVGElement): { scaleX: number; scaleY: number } => {
      const rect = svg.getBoundingClientRect()
      svgRectRef.current = rect
      return {
        scaleX: layout.pageWidthMm / rect.width,
        scaleY: layout.pageHeightMm / rect.height,
      }
    },
    [layout.pageWidthMm, layout.pageHeightMm]
  )

  /** マウス位置に最も近いdragInfo付き線を探す */
  const findNearestDraggableLine = useCallback(
    (clientX: number, clientY: number, svg: SVGSVGElement): DragInfo | null => {
      const rect = svg.getBoundingClientRect()
      const { scaleX, scaleY } = getPxToMm(svg)
      const mouseMmX = (clientX - rect.left) * scaleX
      const mouseMmY = (clientY - rect.top) * scaleY
      const hitDistMm = HIT_DISTANCE_PX * Math.max(scaleX, scaleY)

      let closest: DragInfo | null = null
      let closestDist = hitDistMm

      for (const line of layout.lines) {
        if (!line.dragInfo) continue

        let dist: number
        if (line.dragInfo.axis === "horizontal") {
          // 水平線: Y座標の距離
          dist = Math.abs(mouseMmY - line.y1)
          // X範囲内チェック
          const minX = Math.min(line.x1, line.x2)
          const maxX = Math.max(line.x1, line.x2)
          if (mouseMmX < minX - hitDistMm || mouseMmX > maxX + hitDistMm)
            continue
        } else {
          // 垂直線: X座標の距離
          dist = Math.abs(mouseMmX - line.x1)
          const minY = Math.min(line.y1, line.y2)
          const maxY = Math.max(line.y1, line.y2)
          if (mouseMmY < minY - hitDistMm || mouseMmY > maxY + hitDistMm)
            continue
        }

        if (dist < closestDist) {
          closestDist = dist
          closest = line.dragInfo
        }
      }

      return closest
    },
    [layout.lines, getPxToMm]
  )

  const onMouseDown = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!interactive || !hoveredDragInfo) return

      e.preventDefault()
      dragStateRef.current = {
        dragInfo: hoveredDragInfo,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startValueMm: hoveredDragInfo.currentValueMm,
      }
    },
    [interactive, hoveredDragInfo]
  )

  const onMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!interactive) return

      const svg = e.currentTarget
      const state = dragStateRef.current

      if (state) {
        // ドラッグ中: 新しい値を計算してdispatch
        const rect = svgRectRef.current ?? svg.getBoundingClientRect()
        const { dragInfo, startClientX, startClientY, startValueMm } = state

        let deltaMm: number
        if (dragInfo.axis === "horizontal") {
          const deltaPx = e.clientY - startClientY
          deltaMm = deltaPx * (layout.pageHeightMm / rect.height)
        } else {
          const deltaPx = e.clientX - startClientX
          deltaMm = deltaPx * (layout.pageWidthMm / rect.width)
        }

        const newValueMm = Math.max(dragInfo.minMm, startValueMm + deltaMm)

        if (dragInfo.target.type === "heightMultiplier") {
          const newMultiplier = Math.max(0.5, newValueMm / baseRowHeight)
          const rounded = Math.round(newMultiplier * 4) / 4 // 0.25刻み
          const { majorIndex, subIndex, branchIndex } = dragInfo.target

          if (branchIndex !== undefined) {
            dispatch({
              type: "UPDATE_BRANCH_QUESTION",
              payload: {
                majorIndex,
                subIndex,
                branchIndex,
                data: { heightMultiplier: rounded },
              },
            })
          } else {
            dispatch({
              type: "UPDATE_SUB_QUESTION",
              payload: {
                majorIndex,
                subIndex,
                data: { heightMultiplier: rounded },
              },
            })
          }
        } else if (dragInfo.target.type === "columnWidth") {
          const rounded = Math.max(5, Math.round(newValueMm * 2) / 2) // 0.5mm刻み, 最小5mm
          dispatch({
            type: "UPDATE_SETTINGS",
            payload: {
              columnWidths: { [dragInfo.target.column]: rounded } as Record<
                string,
                number
              >,
            } as never,
          })
        }
      } else {
        // ホバー判定
        const nearest = findNearestDraggableLine(e.clientX, e.clientY, svg)
        setHoveredDragInfo(nearest)
      }
    },
    [
      interactive,
      layout.pageWidthMm,
      layout.pageHeightMm,
      baseRowHeight,
      dispatch,
      findNearestDraggableLine,
    ]
  )

  const onMouseUp = useCallback(() => {
    dragStateRef.current = null
  }, [])

  const onMouseLeave = useCallback(() => {
    dragStateRef.current = null
    setHoveredDragInfo(null)
  }, [])

  let cursor = "default"
  if (interactive && hoveredDragInfo) {
    cursor = hoveredDragInfo.axis === "horizontal" ? "ns-resize" : "ew-resize"
  }

  return {
    hoveredDragInfo,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    cursor,
  }
}
