"use client"

import { RefObject, useCallback } from "react"

interface DragPreviewProps {
  dragging: boolean
  dragStartCoords: { x: number; y: number } | null
  dragCurrentCoords: { x: number; y: number } | null
  imageDimensions: { width: number; height: number } | null
  containerRef: RefObject<HTMLDivElement>
  zoom: number
}

export function DragPreview({
  dragging,
  dragStartCoords,
  dragCurrentCoords,
  imageDimensions,
  containerRef,
  zoom,
}: DragPreviewProps) {
  const calculateDisplayCoords = useCallback(() => {
    if (!dragging || !dragStartCoords || !dragCurrentCoords) {
      return null
    }

    const x = Math.min(dragStartCoords.x, dragCurrentCoords.x)
    const y = Math.min(dragStartCoords.y, dragCurrentCoords.y)
    const width = Math.abs(dragCurrentCoords.x - dragStartCoords.x)
    const height = Math.abs(dragCurrentCoords.y - dragStartCoords.y)

    // Convert relative coordinates to display coordinates
    if (!imageDimensions || !containerRef.current) return null
    
    // 標準スクロール方式：ズームのみ考慮した座標計算
    const scaledImageWidth = imageDimensions.width * zoom
    const scaledImageHeight = imageDimensions.height * zoom
    
    return {
      left: x * scaledImageWidth,
      top: y * scaledImageHeight,
      width: width * scaledImageWidth,
      height: height * scaledImageHeight,
    }
  }, [dragging, dragStartCoords, dragCurrentCoords, imageDimensions, containerRef, zoom])

  const displayCoords = calculateDisplayCoords()
  
  if (!displayCoords) {
    return null
  }

  return (
    <div
      className="absolute border-2 border-red-500 border-dashed bg-red-200 bg-opacity-30 pointer-events-none"
      style={{
        left: `${displayCoords.left}px`,
        top: `${displayCoords.top}px`,
        width: `${displayCoords.width}px`,
        height: `${displayCoords.height}px`,
      }}
    />
  )
}

export default DragPreview