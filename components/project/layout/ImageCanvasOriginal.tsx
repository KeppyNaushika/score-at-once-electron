"use client"

import { LayoutRegionAreaType } from "@/types/common.types"
import { MouseEvent as ReactMouseEvent, useRef, useState } from "react"

type ImageCanvasProps = {
  backgroundImageUrl: string | null
  imageDimensions: { width: number; height: number } | null
  areas: any[]
  selectedAreaIndex: number | null
  onSelectArea: (index: number) => void
  onAddAreaByDrag: (
    type: LayoutRegionAreaType,
    coords: { x: number; y: number; width: number; height: number },
  ) => void
  onUpdateArea: (
    index: number,
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
  onUpdateArea,
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
  const [resizing, setResizing] = useState<{
    areaIndex: number
    handle: "nw" | "ne" | "sw" | "se"
    startCoords: { x: number; y: number }
    originalArea: { x: number; y: number; width: number; height: number }
  } | null>(null)
  const [moving, setMoving] = useState<{
    areaIndex: number
    startCoords: { x: number; y: number }
    originalArea: { x: number; y: number; width: number; height: number }
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

    const rect = imageContainerRef.current.getBoundingClientRect()
    const clickX = (event.clientX - rect.left) / rect.width
    const clickY = (event.clientY - rect.top) / rect.height

    // If not clicking on an existing area, start a new drag
    setDragStartCoords({ x: clickX, y: clickY })
    setDragCurrentCoords({ x: clickX, y: clickY })
    setDragging(true)
  }

  const handleResizeMouseDown = (
    event: ReactMouseEvent<HTMLDivElement, MouseEvent>,
    areaIndex: number,
    handle: "nw" | "ne" | "sw" | "se",
  ) => {
    event.stopPropagation()
    if (!imageContainerRef.current) return

    const rect = imageContainerRef.current.getBoundingClientRect()
    const clickX = (event.clientX - rect.left) / rect.width
    const clickY = (event.clientY - rect.top) / rect.height
    const area = areas[areaIndex]

    setResizing({
      areaIndex,
      handle,
      startCoords: { x: clickX, y: clickY },
      originalArea: {
        x: area.x,
        y: area.y,
        width: area.width,
        height: area.height,
      },
    })
  }

  const handleAreaMouseDown = (
    event: ReactMouseEvent<HTMLDivElement, MouseEvent>,
    areaIndex: number,
  ) => {
    event.stopPropagation()
    if (!imageContainerRef.current) return

    const rect = imageContainerRef.current.getBoundingClientRect()
    const clickX = (event.clientX - rect.left) / rect.width
    const clickY = (event.clientY - rect.top) / rect.height
    const area = areas[areaIndex]

    onSelectArea(areaIndex)
    setMoving({
      areaIndex,
      startCoords: { x: clickX, y: clickY },
      originalArea: {
        x: area.x,
        y: area.y,
        width: area.width,
        height: area.height,
      },
    })
  }

  const handleMouseMove = (
    event: ReactMouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    if (!imageContainerRef.current || !imageDimensions) return

    const rect = imageContainerRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))

    if (dragging && dragStartCoords) {
      setDragCurrentCoords({ x, y })
    } else if (resizing) {
      const { areaIndex, handle, startCoords, originalArea } = resizing
      const deltaX = x - startCoords.x
      const deltaY = y - startCoords.y

      let newArea = { ...originalArea }

      switch (handle) {
        case "nw":
          newArea.x = Math.max(
            0,
            Math.min(
              originalArea.x + originalArea.width - 0.01,
              originalArea.x + deltaX,
            ),
          )
          newArea.y = Math.max(
            0,
            Math.min(
              originalArea.y + originalArea.height - 0.01,
              originalArea.y + deltaY,
            ),
          )
          newArea.width = originalArea.width - (newArea.x - originalArea.x)
          newArea.height = originalArea.height - (newArea.y - originalArea.y)
          break
        case "ne":
          newArea.y = Math.max(
            0,
            Math.min(
              originalArea.y + originalArea.height - 0.01,
              originalArea.y + deltaY,
            ),
          )
          newArea.width = Math.max(
            0.01,
            Math.min(1 - originalArea.x, originalArea.width + deltaX),
          )
          newArea.height = originalArea.height - (newArea.y - originalArea.y)
          break
        case "sw":
          newArea.x = Math.max(
            0,
            Math.min(
              originalArea.x + originalArea.width - 0.01,
              originalArea.x + deltaX,
            ),
          )
          newArea.width = originalArea.width - (newArea.x - originalArea.x)
          newArea.height = Math.max(
            0.01,
            Math.min(1 - originalArea.y, originalArea.height + deltaY),
          )
          break
        case "se":
          newArea.width = Math.max(
            0.01,
            Math.min(1 - originalArea.x, originalArea.width + deltaX),
          )
          newArea.height = Math.max(
            0.01,
            Math.min(1 - originalArea.y, originalArea.height + deltaY),
          )
          break
      }

      onUpdateArea(areaIndex, newArea)
    } else if (moving) {
      const { areaIndex, startCoords, originalArea } = moving
      const deltaX = x - startCoords.x
      const deltaY = y - startCoords.y

      const newX = Math.max(
        0,
        Math.min(1 - originalArea.width, originalArea.x + deltaX),
      )
      const newY = Math.max(
        0,
        Math.min(1 - originalArea.height, originalArea.y + deltaY),
      )

      onUpdateArea(areaIndex, {
        x: newX,
        y: newY,
        width: originalArea.width,
        height: originalArea.height,
      })
    }
  }

  const handleMouseUp = () => {
    if (
      dragging &&
      dragStartCoords &&
      dragCurrentCoords &&
      imageDimensions &&
      masterImageId
    ) {
      const x = Math.min(dragStartCoords.x, dragCurrentCoords.x)
      const y = Math.min(dragStartCoords.y, dragCurrentCoords.y)
      const width = Math.abs(dragStartCoords.x - dragCurrentCoords.x)
      const height = Math.abs(dragStartCoords.y - dragCurrentCoords.y)

      if (width > 0.01 && height > 0.01) {
        onAddAreaByDrag("QUESTION_ANSWER", { x, y, width, height })
      }
    }

    setDragging(false)
    setDragStartCoords(null)
    setDragCurrentCoords(null)
    setResizing(null)
    setMoving(null)
  }

  return (
    <div className="bg-background flex h-full flex-col overflow-hidden">
      {/* Main Image Area */}
      <div className="flex-1 overflow-auto p-4">
        <div
          ref={imageContainerRef}
          className="border-muted-foreground/20 relative rounded-lg border-2 border-dashed bg-white shadow-sm"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            cursor: dragging
              ? "crosshair"
              : backgroundImageUrl && masterImageId
                ? "crosshair"
                : "default",
          }}
        >
          {backgroundImageUrl && imageDimensions ? (
            <>
              <img
                src={backgroundImageUrl}
                alt="模範解答"
                className="pointer-events-none block w-full select-none"
                draggable={false}
              />

              {/* Existing Areas */}
              {areas.map((area, index) => {
                const isSelected = selectedAreaIndex === index
                const typeColors = {
                  ["QUESTION_ANSWER"]: {
                    border: "#3b82f6",
                    bg: "rgba(59, 130, 246, 0.1)",
                  },
                  ["STUDENT_NAME"]: {
                    border: "#10b981",
                    bg: "rgba(16, 185, 129, 0.1)",
                  },
                  ["STUDENT_ID"]: {
                    border: "#f59e0b",
                    bg: "rgba(245, 158, 11, 0.1)",
                  },
                  ["TOTAL_SCORE"]: {
                    border: "#ef4444",
                    bg: "rgba(239, 68, 68, 0.1)",
                  },
                  ["SUBTOTAL_SCORE"]: {
                    border: "#f59e0b",
                    bg: "rgba(245, 158, 11, 0.1)",
                  },
                  ["MARK"]: {
                    border: "#8b5cf6",
                    bg: "rgba(139, 92, 246, 0.1)",
                  },
                  ["COMMENT"]: {
                    border: "#06b6d4",
                    bg: "rgba(6, 182, 212, 0.1)",
                  },
                  ["OTHER"]: {
                    border: "#6b7280",
                    bg: "rgba(107, 114, 128, 0.1)",
                  },
                }
                const colors =
                  typeColors[area.type as keyof typeof typeColors] ||
                  typeColors["OTHER"]

                return (
                  <div
                    key={area.id || `area-${index}`}
                    onMouseDown={(e) => handleAreaMouseDown(e, index)}
                    className="group absolute hover:z-10"
                    style={{
                      left: `${area.x * 100}%`,
                      top: `${area.y * 100}%`,
                      width: `${area.width * 100}%`,
                      height: `${area.height * 100}%`,
                      border: `2px solid ${isSelected ? "#1d4ed8" : colors.border}`,
                      backgroundColor: isSelected
                        ? "rgba(29, 78, 216, 0.2)"
                        : colors.bg,
                      cursor: moving ? "grabbing" : "grab",
                    }}
                  >
                    {/* Label */}
                    <div className="pointer-events-none absolute -top-6 left-0 rounded border bg-white px-2 py-1 text-xs font-medium opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                      {area.label || "領域"}
                    </div>

                    {/* Resize handles for selected area */}
                    {isSelected && (
                      <>
                        <div
                          className="absolute -top-1 -left-1 h-2 w-2 cursor-nw-resize rounded-full border border-white bg-blue-600 transition-transform hover:scale-150"
                          onMouseDown={(e) =>
                            handleResizeMouseDown(e, index, "nw")
                          }
                        ></div>
                        <div
                          className="absolute -top-1 -right-1 h-2 w-2 cursor-ne-resize rounded-full border border-white bg-blue-600 transition-transform hover:scale-150"
                          onMouseDown={(e) =>
                            handleResizeMouseDown(e, index, "ne")
                          }
                        ></div>
                        <div
                          className="absolute -bottom-1 -left-1 h-2 w-2 cursor-sw-resize rounded-full border border-white bg-blue-600 transition-transform hover:scale-150"
                          onMouseDown={(e) =>
                            handleResizeMouseDown(e, index, "sw")
                          }
                        ></div>
                        <div
                          className="absolute -right-1 -bottom-1 h-2 w-2 cursor-se-resize rounded-full border border-white bg-blue-600 transition-transform hover:scale-150"
                          onMouseDown={(e) =>
                            handleResizeMouseDown(e, index, "se")
                          }
                        ></div>
                      </>
                    )}
                  </div>
                )
              })}

              {/* Drag Preview */}
              {dragging && dragStartCoords && dragCurrentCoords && (
                <div
                  className="pointer-events-none absolute border-2 border-dashed border-blue-500 bg-blue-500/10"
                  style={{
                    left: `${Math.min(dragStartCoords.x, dragCurrentCoords.x) * 100}%`,
                    top: `${Math.min(dragStartCoords.y, dragCurrentCoords.y) * 100}%`,
                    width: `${Math.abs(dragStartCoords.x - dragCurrentCoords.x) * 100}%`,
                    height: `${Math.abs(dragStartCoords.y - dragCurrentCoords.y) * 100}%`,
                  }}
                >
                  <div className="absolute -top-6 left-0 rounded bg-blue-600 px-2 py-1 text-xs text-white">
                    新しい領域
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex min-h-[500px] items-center justify-center">
              <div className="text-muted-foreground text-center">
                <div className="mb-4 text-4xl">📄</div>
                <p className="text-lg">模範解答画像を読み込んでください</p>
                <p className="mt-2 text-sm">
                  プロジェクトの模範解答ページで画像をアップロードしてください
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ImageCanvas
