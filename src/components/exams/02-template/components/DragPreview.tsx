"use client"

import type { RefObject } from "react"
import { useCallback, useEffect, useState } from "react"

interface DragPreviewProps {
  dragging: boolean
  dragStartCoords: { x: number; y: number } | null
  dragCurrentCoords: { x: number; y: number } | null
  imageDimensions: { width: number; height: number } | null
  containerRef: RefObject<HTMLDivElement | null>
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
  const [hasContainer, setHasContainer] = useState(false)

  useEffect(() => {
    const node = containerRef.current
    if (!node) {
      return
    }

    let canceled = false
    const frame = requestAnimationFrame(() => {
      if (!canceled) {
        setHasContainer(true)
      }
    })

    return () => {
      canceled = true
      cancelAnimationFrame(frame)
      setHasContainer(false)
    }
  }, [containerRef])

  const calculateDisplayCoords = useCallback(() => {
    if (!dragging || !dragStartCoords || !dragCurrentCoords) {
      return null
    }

    const x = Math.min(dragStartCoords.x, dragCurrentCoords.x)
    const y = Math.min(dragStartCoords.y, dragCurrentCoords.y)
    const width = Math.abs(dragCurrentCoords.x - dragStartCoords.x)
    const height = Math.abs(dragCurrentCoords.y - dragStartCoords.y)

    // Convert relative coordinates to display coordinates
    if (!imageDimensions || !hasContainer) return null

    // 標準スクロール方式：ズームのみ考慮した座標計算
    const scaledImageWidth = imageDimensions.width * zoom
    const scaledImageHeight = imageDimensions.height * zoom

    return {
      left: x * scaledImageWidth,
      top: y * scaledImageHeight,
      width: width * scaledImageWidth,
      height: height * scaledImageHeight,
    }
  }, [
    dragging,
    dragStartCoords,
    dragCurrentCoords,
    imageDimensions,
    zoom,
    hasContainer,
  ])

  const displayCoords = calculateDisplayCoords()

  if (!displayCoords) {
    return null
  }

  return (
    <div
      className="bg-opacity-30 pointer-events-none absolute border-2 border-dashed border-red-500 bg-red-200"
      style={{
        left: `${displayCoords.left}px`,
        top: `${displayCoords.top}px`,
        width: `${displayCoords.width}px`,
        height: `${displayCoords.height}px`,
      }}
    />
  )
}
