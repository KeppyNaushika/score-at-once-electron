"use client"

import { AreaType } from "@prisma/client"
import { MouseEvent as ReactMouseEvent, RefObject, useMemo } from "react"

interface AreaRendererProps {
  areas: any[]
  selectedAreaIndex: number | null
  onSelectArea: (index: number) => void
  onResizeMouseDown: (
    event: ReactMouseEvent<HTMLDivElement, MouseEvent>,
    areaIndex: number,
    handle: "nw" | "ne" | "sw" | "se",
  ) => void
  onMoveMouseDown: (
    event: ReactMouseEvent<HTMLDivElement, MouseEvent>,
    areaIndex: number,
  ) => void
  imageDimensions: { width: number; height: number } | null
  containerRef: RefObject<HTMLDivElement>
  zoom: number
  pan: { x: number; y: number }
}

export function AreaRenderer({
  areas,
  selectedAreaIndex,
  onSelectArea,
  onResizeMouseDown,
  onMoveMouseDown,
  imageDimensions,
  containerRef,
  zoom,
  pan,
}: AreaRendererProps) {
  const getAreaTypeColor = (type: AreaType) => {
    switch (type) {
      case AreaType.QUESTION_ANSWER:
        return "rgba(0, 255, 0, 0.3)"
      case AreaType.STUDENT_NAME:
        return "rgba(0, 0, 255, 0.3)"
      case AreaType.STUDENT_ID:
        return "rgba(255, 0, 255, 0.3)"
      case AreaType.TOTAL_SCORE:
        return "rgba(255, 255, 0, 0.3)"
      case AreaType.SUBTOTAL_SCORE:
        return "rgba(255, 165, 0, 0.3)"
      default:
        return "rgba(128, 128, 128, 0.3)"
    }
  }

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

  const convertAreaToDisplayCoords = (area: any) => {
    if (!imageDimensions || !containerRef.current) {
      return { left: 0, top: 0, width: 0, height: 0 }
    }
    
    const containerRect = containerRef.current.getBoundingClientRect()
    const containerWidth = containerRect.width
    const containerHeight = containerRect.height
    
    // コンテナサイズが0の場合は描画しない（初期化中）
    if (containerWidth === 0 || containerHeight === 0) {
      return { left: 0, top: 0, width: 0, height: 0 }
    }
    
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
    
    return {
      left: offsetX + (area.x * actualImageWidth),
      top: offsetY + (area.y * actualImageHeight),
      width: area.width * actualImageWidth,
      height: area.height * actualImageHeight,
    }
  }

  return (
    <>
      {areas.map((area, index) => {
        const displayCoords = convertAreaToDisplayCoords(area)
        
        // サイズが0の場合は描画しない
        if (displayCoords.width === 0 || displayCoords.height === 0) {
          return null
        }
        
        return (
          <div
            key={area.id || `area-${index}`}
            className={`absolute border-2 cursor-pointer ${
              selectedAreaIndex === index
                ? "border-blue-500 border-solid"
                : "border-white border-dashed"
            }`}
            style={{
              left: `${displayCoords.left}px`,
              top: `${displayCoords.top}px`,
              width: `${displayCoords.width}px`,
              height: `${displayCoords.height}px`,
              backgroundColor: getAreaTypeColor(area.type),
            }}
            onClick={(e) => {
              e.stopPropagation()
              onSelectArea(index)
            }}
            onMouseDown={(e) => {
              e.stopPropagation()
              onMoveMouseDown(e, index)
            }}
          >
            {/* ラベル */}
            <div className="absolute -top-6 left-0 text-xs bg-white px-1 rounded border text-black">
              {area.label}
            </div>

            {/* リサイズハンドル */}
            {selectedAreaIndex === index && (
              <>
                {/* 左上 */}
                <div
                  className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 border border-white cursor-nw-resize"
                  onMouseDown={(e) => onResizeMouseDown(e, index, "nw")}
                />
                {/* 右上 */}
                <div
                  className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 border border-white cursor-ne-resize"
                  onMouseDown={(e) => onResizeMouseDown(e, index, "ne")}
                />
                {/* 左下 */}
                <div
                  className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 border border-white cursor-sw-resize"
                  onMouseDown={(e) => onResizeMouseDown(e, index, "sw")}
                />
                {/* 右下 */}
                <div
                  className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 border border-white cursor-se-resize"
                  onMouseDown={(e) => onResizeMouseDown(e, index, "se")}
                />
              </>
            )}
          </div>
        )
      })}
    </>
  )
}