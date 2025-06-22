"use client"

import React, { useRef, useState, MouseEvent as ReactMouseEvent } from "react"
import { AreaType, Prisma } from "@prisma/client" // Prismaをインポート

type ImageCanvasProps = {
  backgroundImageUrl: string | null
  imageDimensions: { width: number; height: number } | null
  areas: any[]
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
    <div className="h-full flex flex-col bg-background">
      {/* Instructions */}
      <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">🎨 採点領域を作成</h3>
          <p className="text-sm text-blue-700">
            模範解答上でマウスをドラッグして採点したい領域を囲んでください
          </p>
          <p className="text-xs text-blue-600 mt-1">
            設問、氏名欄、学籍番号欄など、必要な領域をすべて作成してください
          </p>
        </div>
      </div>
      
      {/* Main Image Area */}
      <div className="flex-1 p-4 overflow-auto">
        <div
          ref={imageContainerRef}
          className="relative w-full h-full min-h-[500px] rounded-lg border-2 border-dashed border-muted-foreground/20 bg-white shadow-sm"
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
            <div className="relative w-full h-full">
              <img
                src={backgroundImageUrl}
                alt="模範解答"
                className="w-full h-full object-contain select-none pointer-events-none"
                draggable={false}
              />
              
              {/* Existing Areas */}
              {areas.map((area, index) => {
                const isSelected = selectedAreaIndex === index
                const typeColors = {
                  [AreaType.QUESTION_ANSWER]: { border: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)" },
                  [AreaType.STUDENT_NAME]: { border: "#10b981", bg: "rgba(16, 185, 129, 0.1)" },
                  [AreaType.STUDENT_ID]: { border: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)" },
                  [AreaType.TOTAL_SCORE]: { border: "#ef4444", bg: "rgba(239, 68, 68, 0.1)" },
                  [AreaType.SUBTOTAL_SCORE]: { border: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)" },
                  [AreaType.MARK]: { border: "#8b5cf6", bg: "rgba(139, 92, 246, 0.1)" },
                  [AreaType.COMMENT]: { border: "#06b6d4", bg: "rgba(6, 182, 212, 0.1)" },
                  [AreaType.OTHER]: { border: "#6b7280", bg: "rgba(107, 114, 128, 0.1)" },
                }
                const colors = typeColors[area.type as AreaType] || typeColors[AreaType.OTHER]
                
                return (
                  <div
                    key={area.id || `area-${index}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectArea(index)
                    }}
                    className="absolute group hover:z-10 transition-all duration-200"
                    style={{
                      left: `${area.x * 100}%`,
                      top: `${area.y * 100}%`,
                      width: `${area.width * 100}%`,
                      height: `${area.height * 100}%`,
                      border: `2px solid ${isSelected ? '#1d4ed8' : colors.border}`,
                      backgroundColor: isSelected ? 'rgba(29, 78, 216, 0.2)' : colors.bg,
                      cursor: "pointer",
                    }}
                  >
                    {/* Label */}
                    <div className="absolute -top-6 left-0 px-2 py-1 bg-white border rounded text-xs font-medium shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                      {area.label || '領域'}
                    </div>
                    
                    {/* Resize handles for selected area */}
                    {isSelected && (
                      <>
                        <div className="absolute -top-1 -left-1 w-2 h-2 bg-blue-600 border border-white rounded-full"></div>
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-600 border border-white rounded-full"></div>
                        <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-blue-600 border border-white rounded-full"></div>
                        <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-blue-600 border border-white rounded-full"></div>
                      </>
                    )}
                  </div>
                )
              })}
              
              {/* Drag Preview */}
              {dragging && dragStartCoords && dragCurrentCoords && (
                <div
                  className="absolute border-2 border-dashed border-blue-500 bg-blue-500/10 pointer-events-none"
                  style={{
                    left: `${Math.min(dragStartCoords.x, dragCurrentCoords.x) * 100}%`,
                    top: `${Math.min(dragStartCoords.y, dragCurrentCoords.y) * 100}%`,
                    width: `${Math.abs(dragStartCoords.x - dragCurrentCoords.x) * 100}%`,
                    height: `${Math.abs(dragStartCoords.y - dragCurrentCoords.y) * 100}%`,
                  }}
                >
                  <div className="absolute -top-6 left-0 px-2 py-1 bg-blue-600 text-white text-xs rounded">
                    新しい領域
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <div className="text-4xl mb-4">📄</div>
                <p className="text-lg">模範解答画像を読み込んでください</p>
                <p className="text-sm mt-2">プロジェクトの模範解答ページで画像をアップロードしてください</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ImageCanvas
