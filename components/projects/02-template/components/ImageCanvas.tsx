/**
 * ImageCanvas - Main canvas component for layout region editing
 *
 * Features:
 * - Drag to create new regions
 * - Zoom and pan functionality
 * - Keyboard shortcuts for area management
 * - Area rendering and interaction
 *
 * @param props - Configuration properties for the canvas
 * @returns JSX component for the image canvas
 */

"use client"

import { CropRegionArea, CropRegionAreaType } from "@/types/common.types"
import { useMemo } from "react"
import { useImageCanvasInteraction } from "../hooks/useImageCanvasInteraction"
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts"
import { useZoomControls } from "../hooks/useZoomControls"
import { AreaRenderer } from "./AreaRenderer"
import { DragPreview } from "./DragPreview"
import { ZoomControls } from "./ZoomControls"

type ImageCanvasProps = {
  backgroundImageUrl: string | null
  imageDimensions: { width: number; height: number } | null
  areas: CropRegionArea[]
  selectedAreaIndex: number | null
  onSelectArea: (index: number) => void
  onAddAreaByDrag: (
    type: CropRegionAreaType,
    coords: { x: number; y: number; width: number; height: number },
  ) => void
  onUpdateArea: (
    index: number,
    coords: { x: number; y: number; width: number; height: number },
  ) => void
  onDeleteArea: (index: number) => void
  disabled: boolean
  projectPageId: string | null
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
  projectPageId,
}: ImageCanvasProps) => {
  // Get zoom controls first
  const { zoom, showZoomHelp, setShowZoomHelp, imageContainerRef } =
    useZoomControls()

  const {
    dragging,
    dragStartCoords,
    dragCurrentCoords,
    handleMouseDown,
    handleResizeMouseDown,
    handleMoveMouseDown,
  } = useImageCanvasInteraction({
    disabled,
    backgroundImageUrl,
    imageDimensions,
    projectPageId,
    areas,
    onAddAreaByDrag,
    onUpdateArea,
    zoom,
    imageContainerRef: imageContainerRef as React.RefObject<HTMLDivElement>,
  })

  useKeyboardShortcuts(selectedAreaIndex, onDeleteArea)

  // Calculate image dimensions based on zoom
  const imageDimensionsWithZoom = useMemo(
    () => ({
      width: imageDimensions ? imageDimensions.width * zoom : 0,
      height: imageDimensions ? imageDimensions.height * zoom : 0,
    }),
    [imageDimensions, zoom],
  )

  return (
    <div className="relative h-full w-full bg-gray-100">
      <ZoomControls
        zoom={zoom}
        showZoomHelp={showZoomHelp}
        onToggleHelp={setShowZoomHelp}
      />

      {/* 標準HTMLスクロール可能なコンテナ */}
      <div
        className="scrollbar-overlay h-full w-full overflow-auto"
        tabIndex={0}
      >
        <div
          ref={imageContainerRef}
          className="relative cursor-crosshair focus:outline-none"
          style={{
            width: `${imageDimensionsWithZoom.width}px`,
            height: `${imageDimensionsWithZoom.height}px`,
            backgroundImage: backgroundImageUrl
              ? `url(${backgroundImageUrl})`
              : "none",
            backgroundSize: `${imageDimensionsWithZoom.width}px ${imageDimensionsWithZoom.height}px`,
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
