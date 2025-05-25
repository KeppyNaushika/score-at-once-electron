"use client"

import React, { useRef, useState, MouseEvent as ReactMouseEvent } from "react"
import { AreaType, Prisma } from "@prisma/client" // Prismaをインポート

type ImageCanvasProps = {
  backgroundImageUrl: string | null
  imageDimensions: { width: number; height: number } | null
  areas: (Omit<
    // any[] から具体的な型に変更
    Prisma.LayoutRegionCreateWithoutProjectLayoutInput,
    "masterImage"
  > & { id?: string; masterImageId: string })[]
  selectedAreaIndex: number | null
  onSelectArea: (index: number) => void
  onAddAreaByDrag: (
    type: AreaType,
    coords: { x: number; y: number; width: number; height: number },
  ) => void
  disabled: boolean
  masterImageId: string | null
}

const ImageCanvas = ({
  backgroundImageUrl,
  imageDimensions,
  areas,
  selectedAreaIndex,
  onSelectArea,
  onAddAreaByDrag,
  disabled,
  masterImageId,
}: ImageCanvasProps) => {
  const [dragging, setDragging] = useState(false)
  const [dragStartCoords, setDragStartCoords] = useState<{
    x: number
    y: number
  } | null>(null)
  const [dragCurrentCoords, setDragCurrentCoords] = useState<{
    x: number
    y: number
  } | null>(null)
  const imageContainerRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (
    event: ReactMouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    if (
      disabled ||
      !backgroundImageUrl ||
      !imageDimensions ||
      !imageContainerRef.current ||
      !masterImageId
    )
      return

    // Check if the click is on an existing area
    const rect = imageContainerRef.current.getBoundingClientRect()
    const clickX = (event.clientX - rect.left) / rect.width
    const clickY = (event.clientY - rect.top) / rect.height

    for (let i = areas.length - 1; i >= 0; i--) {
      const area = areas[i]
      if (
        clickX >= area.x &&
        clickX <= area.x + area.width &&
        clickY >= area.y &&
        clickY <= area.y + area.height
      ) {
        onSelectArea(i)
        // Prevent starting a new drag if an existing area is clicked
        // and allow potential drag-to-resize/move in the future by not setting dragStartCoords here
        return
      }
    }

    // If not clicking on an existing area, start a new drag
    setDragStartCoords({ x: clickX, y: clickY })
    setDragCurrentCoords({ x: clickX, y: clickY })
    setDragging(true)
  }

  const handleMouseMove = (
    event: ReactMouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    if (
      !dragging ||
      !dragStartCoords ||
      !imageContainerRef.current ||
      !imageDimensions
    )
      return
    const rect = imageContainerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    setDragCurrentCoords({ x, y })
  }

  const handleMouseUp = () => {
    if (
      !dragging ||
      !dragStartCoords ||
      !dragCurrentCoords ||
      !imageDimensions ||
      !masterImageId
    ) {
      setDragging(false)
      setDragStartCoords(null)
      setDragCurrentCoords(null)
      return
    }

    const x = Math.min(dragStartCoords.x, dragCurrentCoords.x)
    const y = Math.min(dragStartCoords.y, dragCurrentCoords.y)
    const width = Math.abs(dragStartCoords.x - dragCurrentCoords.x)
    const height = Math.abs(dragStartCoords.y - dragCurrentCoords.y)

    if (width > 0.01 && height > 0.01) {
      onAddAreaByDrag(AreaType.QUESTION_ANSWER, { x, y, width, height })
    }

    setDragging(false)
    setDragStartCoords(null)
    setDragCurrentCoords(null)
  }

  return (
    <div
      ref={imageContainerRef}
      className="relative col-span-2 min-h-[400px] rounded-md border bg-gray-100 p-2"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp} // Container out also ends drag
      style={{
        cursor: dragging
          ? "crosshair"
          : backgroundImageUrl && masterImageId
            ? "crosshair"
            : "default",
      }}
    >
      {backgroundImageUrl && imageDimensions ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <img
            src={backgroundImageUrl}
            alt="Master Template"
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              objectFit: "contain",
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
          {areas.map((area, index) => (
            <div
              key={area.id || `area-${index}`}
              onClick={(e) => {
                e.stopPropagation() // Prevent triggering onMouseDown on the parent
                onSelectArea(index)
              }}
              style={{
                position: "absolute",
                left: `${area.x * 100}%`,
                top: `${area.y * 100}%`,
                width: `${area.width * 100}%`,
                height: `${area.height * 100}%`,
                border: `1px solid ${
                  selectedAreaIndex === index ? "blue" : "rgba(255,0,0,0.7)"
                }`,
                backgroundColor: `${selectedAreaIndex === index ? "rgba(0, 0, 255, 0.2)" : "rgba(255, 0, 0, 0.1)"}`,
                cursor: "pointer",
              }}
            />
          ))}
          {dragging && dragStartCoords && dragCurrentCoords && (
            <div
              style={{
                position: "absolute",
                left: `${Math.min(dragStartCoords.x, dragCurrentCoords.x) * 100}%`,
                top: `${Math.min(dragStartCoords.y, dragCurrentCoords.y) * 100}%`,
                width: `${Math.abs(dragStartCoords.x - dragCurrentCoords.x) * 100}%`,
                height: `${Math.abs(dragStartCoords.y - dragCurrentCoords.y) * 100}%`,
                border: "1px dashed blue",
                backgroundColor: "rgba(0, 0, 255, 0.1)",
                pointerEvents: "none",
              }}
            />
          )}
        </div>
      ) : (
        <p className="text-muted-foreground flex h-full items-center justify-center text-center">
          模範解答画像を読み込んでください。
        </p>
      )}
    </div>
  )
}

export default ImageCanvas
