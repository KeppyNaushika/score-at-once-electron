"use client"

import { AreaType } from "@prisma/client"
import { useImageCanvasInteraction } from "./hooks/useImageCanvasInteraction"
import { AreaRenderer } from "./components/AreaRenderer"
import { DragPreview } from "./components/DragPreview"
import { LayoutRegionArea } from "../../../types/common.types"
import { useCallback, useEffect, useState } from "react"

type ImageCanvasProps = {
  backgroundImageUrl: string | null
  imageDimensions: { width: number; height: number } | null
  areas: LayoutRegionArea[]
  selectedAreaIndex: number | null
  onSelectArea: (index: number) => void
  onAddAreaByDrag: (
    type: AreaType,
    coords: { x: number; y: number; width: number; height: number },
  ) => void
  onUpdateArea: (
    index: number,
    coords: { x: number; y: number; width: number; height: number },
  ) => void
  onDeleteArea: (index: number) => void
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
  onDeleteArea,
  disabled,
  masterImageId,
}: ImageCanvasProps) => {
  // zoom/pan機能は一旦無効にして基本機能を修正
  const zoom = 1
  const pan = { x: 0, y: 0 }
  const [isPanning, setIsPanning] = useState(false)

  const {
    dragging,
    dragStartCoords,
    dragCurrentCoords,
    imageContainerRef,
    handleMouseDown,
    handleResizeMouseDown,
    handleMoveMouseDown,
  } = useImageCanvasInteraction({
    disabled,
    backgroundImageUrl,
    imageDimensions,
    masterImageId,
    areas,
    onAddAreaByDrag,
    onUpdateArea,
    zoom,
    pan,
  })

  // キーボードイベントハンドラー（削除機能のみ）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedAreaIndex !== null) {
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault()
          onDeleteArea(selectedAreaIndex)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedAreaIndex, onDeleteArea])


  return (
    <div className="relative w-full h-full overflow-hidden bg-gray-100">
      {/* 操作ヘルプ */}
      <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white text-xs p-2 rounded z-10">
        <div>ドラッグ: 採点領域作成</div>
        <div>削除: BackSpace / Delete</div>
      </div>

      {/* 背景画像とインタラクション */}
      <div
        ref={imageContainerRef}
        className="relative w-full h-full cursor-crosshair overflow-hidden"
        onMouseDown={(e) => {
          if (e.button === 0) {
            handleMouseDown(e)
          }
        }}
        style={{
          backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : "none",
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat", 
          backgroundPosition: "center",
        }}
      >
        <AreaRenderer
          areas={areas}
          selectedAreaIndex={selectedAreaIndex}
          onSelectArea={onSelectArea}
          onResizeMouseDown={handleResizeMouseDown}
          onMoveMouseDown={handleMoveMouseDown}
          imageDimensions={imageDimensions}
          containerRef={imageContainerRef}
          zoom={zoom}
          pan={pan}
        />

        <DragPreview
          dragging={dragging}
          dragStartCoords={dragStartCoords}
          dragCurrentCoords={dragCurrentCoords}
          imageDimensions={imageDimensions}
          containerRef={imageContainerRef}
          zoom={zoom}
          pan={pan}
        />
      </div>
    </div>
  )
}

export default ImageCanvas