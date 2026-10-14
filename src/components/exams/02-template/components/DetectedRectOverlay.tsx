/**
 * 検出枠オーバーレイコンポーネント
 * 検出された枠を青い破線で表示
 */

"use client"

import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react"
import { memo, useCallback, useRef, useState } from "react"

import { OVERLAY_STYLES } from "../constants/detection"
import type { DetectedRect, ImageDimensions } from "../types"

/**
 * 押してから離すまでにこれ以上動いたら、クリックではなくドラッグとみなす（px）。
 * 検出枠の上から始めたドラッグも新しい枠の作成になるので、離したときのクリックで
 * 検出枠からもう1つ作ってはいけない
 */
const CLICK_MOVE_TOLERANCE_PX = 4

interface DetectedRectOverlayProps {
  /** 検出された矩形 */
  detectedRects: DetectedRect[]
  /** 画像の寸法 */
  imageDimensions: ImageDimensions | null
  /** ズーム倍率 */
  zoom: number
  /** 表示/非表示 */
  visible: boolean
  /** クリックハンドラ */
  onRectClick?: (rect: DetectedRect) => void
}

/**
 * 検出枠オーバーレイコンポーネント
 */
export const DetectedRectOverlay = memo(function DetectedRectOverlay({
  detectedRects,
  imageDimensions,
  zoom,
  visible,
  onRectClick,
}: DetectedRectOverlayProps) {
  const [hoveredRectId, setHoveredRectId] = useState<string | null>(null)
  // 検出枠の上で押した位置。離したときのクリックがドラッグの終わりかを見分ける
  const pointerDownPositionRef = useRef<{ x: number; y: number } | null>(null)

  const handleMouseEnter = useCallback((rectId: string) => {
    setHoveredRectId(rectId)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHoveredRectId(null)
  }, [])

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      pointerDownPositionRef.current = { x: event.clientX, y: event.clientY }
    },
    []
  )

  const handleClick = useCallback(
    (rect: DetectedRect, event: ReactMouseEvent<HTMLDivElement>) => {
      const pointerDownPosition = pointerDownPositionRef.current
      pointerDownPositionRef.current = null
      if (
        pointerDownPosition &&
        Math.hypot(
          event.clientX - pointerDownPosition.x,
          event.clientY - pointerDownPosition.y
        ) > CLICK_MOVE_TOLERANCE_PX
      ) {
        return
      }
      if (onRectClick) {
        onRectClick(rect)
      }
    },
    [onRectClick]
  )

  if (!visible || !imageDimensions || detectedRects.length === 0) {
    return null
  }

  const { width: imgWidth, height: imgHeight } = imageDimensions

  return (
    <div
      className="pointer-events-none absolute top-0 left-0"
      style={{
        width: imgWidth * zoom,
        height: imgHeight * zoom,
      }}
    >
      {detectedRects.map((rect) => {
        const isHovered = hoveredRectId === rect.id
        const left = rect.x * imgWidth * zoom
        const top = rect.y * imgHeight * zoom
        const width = rect.width * imgWidth * zoom
        const height = rect.height * imgHeight * zoom

        return (
          <div
            key={rect.id}
            className="pointer-events-auto absolute cursor-pointer transition-all duration-100"
            style={{
              left,
              top,
              width,
              height,
              border: `${isHovered ? OVERLAY_STYLES.strokeWidthHover : OVERLAY_STYLES.strokeWidth}px dashed ${isHovered ? OVERLAY_STYLES.strokeColorHover : OVERLAY_STYLES.strokeColor}`,
              backgroundColor: isHovered
                ? OVERLAY_STYLES.fillColorHover
                : OVERLAY_STYLES.fillColor,
              boxSizing: "border-box",
            }}
            onMouseEnter={() => handleMouseEnter(rect.id)}
            onMouseLeave={handleMouseLeave}
            onPointerDown={handlePointerDown}
            onClick={(event) => handleClick(rect, event)}
          >
            {isHovered && (
              <div className="absolute -top-6 left-0 rounded bg-blue-600 px-2 py-0.5 text-xs whitespace-nowrap text-white">
                {Math.round(rect.width * 100)}% ×{" "}
                {Math.round(rect.height * 100)}%
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
})
