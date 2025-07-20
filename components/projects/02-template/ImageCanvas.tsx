"use client"

import { AreaRenderer } from "@/components/projects/02-template/AreaRenderer"
import { DragPreview } from "@/components/projects/02-template/DragPreview"
import { useImageCanvasInteraction } from "@/components/projects/02-template/hooks/useImageCanvasInteraction"
import { LayoutRegionArea, LayoutRegionAreaType } from "@/types/common.types"
import { useEffect, useState } from "react"

type ImageCanvasProps = {
  backgroundImageUrl: string | null
  imageDimensions: { width: number; height: number } | null
  areas: LayoutRegionArea[]
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
  // ズーム機能のみ実装（パンはブラウザ標準スクロール）
  const [zoom, setZoom] = useState(1)
  const [showZoomHelp, setShowZoomHelp] = useState(true)

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
  })

  // キーボードイベントハンドラー（削除機能 + ズーム機能）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 削除機能
      if (selectedAreaIndex !== null) {
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault()
          onDeleteArea(selectedAreaIndex)
          return
        }
      }

      // ズーム機能（ImageCanvasがフォーカスされているとき）
      if (
        imageContainerRef.current &&
        imageContainerRef.current.contains(document.activeElement)
      ) {
        switch (e.key) {
          case "+":
          case "=":
            if (e.ctrlKey) {
              e.preventDefault()
              e.stopPropagation()
              setZoom((prev) => Math.min(5, prev + 0.1))
            }
            break
          case "-":
            if (e.ctrlKey) {
              e.preventDefault()
              e.stopPropagation()
              setZoom((prev) => Math.max(0.1, prev - 0.1))
            }
            break
          case "0":
            if (e.ctrlKey) {
              e.preventDefault()
              e.stopPropagation()
              setZoom(1)
            }
            break
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [selectedAreaIndex, onDeleteArea, imageContainerRef])

  // シンプルなホイールズーム機能
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
        const zoomSpeed = 0.005
        const newZoom = zoom - e.deltaY * zoomSpeed
        setZoom(Math.max(0.1, Math.min(5, newZoom)))
      }
    }

    const container = imageContainerRef.current
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false })
    }

    return () => {
      if (container) {
        container.removeEventListener("wheel", handleWheel)
      }
    }
  }, [zoom, imageContainerRef])

  // 画像サイズの計算
  const imageWidth = imageDimensions ? imageDimensions.width * zoom : 0
  const imageHeight = imageDimensions ? imageDimensions.height * zoom : 0

  return (
    <div className="relative h-full w-full bg-gray-100">
      {/* ズーム操作のヘルプ表示 */}
      {showZoomHelp && (
        <div className="bg-opacity-70 absolute top-2 right-2 z-20 max-w-xs rounded bg-black p-2 text-xs text-white">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-semibold">操作:</span>
            <button
              onClick={() => setShowZoomHelp(false)}
              className="ml-2 text-white hover:text-gray-300"
              aria-label="ヘルプを閉じる"
            >
              ×
            </button>
          </div>
          <div>スクロール: 標準ブラウザスクロール</div>
          <div>Ctrl + ホイール: ズーム</div>
          <div>Ctrl + +/-: ズーム</div>
          <div>Ctrl + 0: リセット</div>
          <div>ズーム: {Math.round(zoom * 100)}%</div>
        </div>
      )}

      {/* ヘルプ再表示ボタン */}
      {!showZoomHelp && (
        <button
          onClick={() => setShowZoomHelp(true)}
          className="absolute top-2 right-2 z-20 rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600"
          aria-label="ヘルプを表示"
        >
          ?
        </button>
      )}

      {/* 標準HTMLスクロール可能なコンテナ */}
      <div
        className="scrollbar-overlay h-full w-full overflow-auto"
        tabIndex={0}
      >
        <div
          ref={imageContainerRef}
          className="relative cursor-crosshair focus:outline-none"
          style={{
            width: `${imageWidth}px`,
            height: `${imageHeight}px`,
            backgroundImage: backgroundImageUrl
              ? `url(${backgroundImageUrl})`
              : "none",
            backgroundSize: `${imageWidth}px ${imageHeight}px`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "0 0",
            minWidth: "400px",
            minHeight: "300px",
          }}
          onMouseDown={handleMouseDown}
        >
          <AreaRenderer
            areas={areas}
            selectedAreaIndex={selectedAreaIndex}
            onSelectArea={onSelectArea}
            onResizeMouseDown={handleResizeMouseDown}
            onMoveMouseDown={handleMoveMouseDown}
            imageDimensions={imageDimensions}
            containerRef={imageContainerRef as any}
            zoom={zoom}
          />

          <DragPreview
            dragging={dragging}
            dragStartCoords={dragStartCoords}
            dragCurrentCoords={dragCurrentCoords}
            imageDimensions={imageDimensions}
            containerRef={imageContainerRef as any}
            zoom={zoom}
          />
        </div>
      </div>
    </div>
  )
}

export default ImageCanvas
