/**
 * Canvas coordinate calculation utilities
 */

import { useCallback } from "react"

/**
 * Custom hook for handling coordinate calculations on the image canvas
 *
 * @param imageDimensions - The original dimensions of the image
 * @param zoom - Current zoom level
 * @returns Object containing coordinate calculation functions
 */
export function useCanvasCoordinates(
  imageDimensions: { width: number; height: number } | null,
  zoom: number
) {
  /**
   * Calculate the bounds of the image within the container
   *
   * @param imageContainerRef - Reference to the image container element
   * @returns Image bounds or null if calculations cannot be performed
   */
  const getImageBounds = useCallback(
    (imageContainerRef: React.RefObject<HTMLDivElement>) => {
      if (!imageContainerRef.current || !imageDimensions) return null

      // 標準スクロール方式：画像コンテナのサイズがそのまま画像サイズ
      const scaledImageWidth = imageDimensions.width * zoom
      const scaledImageHeight = imageDimensions.height * zoom

      return {
        left: 0,
        top: 0,
        width: scaledImageWidth,
        height: scaledImageHeight,
      }
    },
    [imageDimensions, zoom]
  )

  /**
   * Convert client coordinates to relative coordinates (0-1 range)
   *
   * @param clientX - Client X coordinate
   * @param clientY - Client Y coordinate
   * @param imageContainerRef - Reference to the image container element
   * @returns Relative coordinates normalized to 0-1 range
   */
  const getRelativeCoords = useCallback(
    (
      clientX: number,
      clientY: number,
      imageContainerRef: React.RefObject<HTMLDivElement>
    ) => {
      if (!imageContainerRef.current) return { x: 0, y: 0 }

      const containerRect = imageContainerRef.current.getBoundingClientRect()
      const imageBounds = getImageBounds(imageContainerRef)

      if (!imageBounds) return { x: 0, y: 0 }

      // 標準スクロール方式：コンテナの左上角が画像の原点
      const x = (clientX - containerRect.left) / imageBounds.width
      const y = (clientY - containerRect.top) / imageBounds.height

      return {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
      }
    },
    [getImageBounds]
  )

  return {
    getImageBounds,
    getRelativeCoords,
  }
}
