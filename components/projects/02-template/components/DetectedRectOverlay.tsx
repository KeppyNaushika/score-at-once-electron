/**
 * 検出枠オーバーレイコンポーネント
 * 検出された枠を青い破線で表示
 */

"use client"

import { memo, useState, useCallback } from "react"
import { DetectedRect, ImageDimensions } from "../types"
import { OVERLAY_STYLES } from "../constants/detection"

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

  const handleMouseEnter = useCallback((rectId: string) => {
    setHoveredRectId(rectId)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setHoveredRectId(null)
  }, [])

  const handleClick = useCallback(
    (rect: DetectedRect) => {
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
            onClick={() => handleClick(rect)}
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
