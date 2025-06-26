"use client"

import { RefObject, useMemo } from "react"

interface DragPreviewProps {
  dragging: boolean
  dragStartCoords: { x: number; y: number } | null
  dragCurrentCoords: { x: number; y: number } | null
  imageDimensions: { width: number; height: number } | null
  containerRef: RefObject<HTMLDivElement>
  zoom: number
  pan: { x: number; y: number }
}

export function DragPreview({
  dragging,
  dragStartCoords,
  dragCurrentCoords,
  imageDimensions,
  containerRef,
  zoom,
  pan,
}: DragPreviewProps) {
  // Calculate the actual image display bounds within the container
  const imageBounds = useMemo(() => {
    if (!imageDimensions || !containerRef.current) {
      return { left: 0, top: 0, width: 100, height: 100 }
    }

    const containerRect = containerRef.current.getBoundingClientRect()
    const containerWidth = containerRect.width
    const containerHeight = containerRect.height
    const containerAspect = containerWidth / containerHeight
    const imageAspect = imageDimensions.width / imageDimensions.height

    let imageWidth, imageHeight, imageLeft, imageTop

    if (imageAspect > containerAspect) {
      // Image is wider - constrained by container width
      imageWidth = containerWidth
      imageHeight = containerWidth / imageAspect
      imageLeft = 0
      imageTop = (containerHeight - imageHeight) / 2
    } else {
      // Image is taller - constrained by container height
      imageHeight = containerHeight
      imageWidth = containerHeight * imageAspect
      imageLeft = (containerWidth - imageWidth) / 2
      imageTop = 0
    }

    return {
      left: imageLeft,
      top: imageTop,
      width: imageWidth,
      height: imageHeight,
    }
  }, [imageDimensions, containerRef])

  if (!dragging || !dragStartCoords || !dragCurrentCoords) {
    return null
  }

  const x = Math.min(dragStartCoords.x, dragCurrentCoords.x)
  const y = Math.min(dragStartCoords.y, dragCurrentCoords.y)
  const width = Math.abs(dragCurrentCoords.x - dragStartCoords.x)
  const height = Math.abs(dragCurrentCoords.y - dragStartCoords.y)

  // Convert relative coordinates to display coordinates
  if (!imageDimensions || !containerRef.current) return null
  
  const containerRect = containerRef.current.getBoundingClientRect()
  const containerWidth = containerRect.width
  const containerHeight = containerRect.height
  
  // 画像の実際の表示サイズを計算
  const imageAspect = imageDimensions.width / imageDimensions.height
  const containerAspect = containerWidth / containerHeight
  
  let actualImageWidth, actualImageHeight, offsetX, offsetY
  
  if (imageAspect > containerAspect) {
    // 画像が横長 - 幅がコンテナに合わせられる
    actualImageWidth = containerWidth
    actualImageHeight = containerWidth / imageAspect
    offsetX = 0
    offsetY = (containerHeight - actualImageHeight) / 2
  } else {
    // 画像が縦長 - 高さがコンテナに合わせられる
    actualImageHeight = containerHeight
    actualImageWidth = containerHeight * imageAspect
    offsetX = (containerWidth - actualImageWidth) / 2
    offsetY = 0
  }
  
  const displayLeft = offsetX + (x * actualImageWidth)
  const displayTop = offsetY + (y * actualImageHeight)
  const displayWidth = width * actualImageWidth
  const displayHeight = height * actualImageHeight

  return (
    <div
      className="absolute border-2 border-red-500 border-dashed bg-red-200 bg-opacity-30 pointer-events-none"
      style={{
        left: `${displayLeft}px`,
        top: `${displayTop}px`,
        width: `${displayWidth}px`,
        height: `${displayHeight}px`,
      }}
    />
  )
}