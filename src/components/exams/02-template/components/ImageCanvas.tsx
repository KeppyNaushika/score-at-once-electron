/**
 * ImageCanvas - Main canvas component for layout region editing
 *
 * Features:
 * - Drag to create new regions
 * - Zoom and pan functionality
 * - Keyboard shortcuts for area management
 * - Area rendering and interaction
 * - Auto-detection overlay for detected frames
 *
 * @param props - Configuration properties for the canvas
 * @returns JSX component for the image canvas
 */

"use client"

import { useMemo } from "react"

import type { CropRegionArea } from "@/components/exams/02-template/types"
import type { CropRegionAreaType } from "@/types/cropRegionAreaType.types"

import { useImageCanvasInteraction } from "../hooks/useImageCanvasInteraction"
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts"
import { useZoomControls } from "../hooks/useZoomControls"
import type { DetectedRect, DetectionMode, DragSelectionResult } from "../types"
import { AreaRenderer } from "./AreaRenderer"
import { DetectedRectOverlay } from "./DetectedRectOverlay"
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
    coords: { x: number; y: number; width: number; height: number }
  ) => void
  onUpdateArea: (
    index: number,
    coords: { x: number; y: number; width: number; height: number }
  ) => void
  onDeleteArea: (index: number) => void
  disabled: boolean
  examPageId: string | null
  // 検出関連のプロパティ
  detectedRects?: DetectedRect[]
  detectionMode?: DetectionMode
  onDetectedRectClick?: (rect: DetectedRect) => void
  onSnapToDetectedRects?: (dragRect: {
    x: number
    y: number
    width: number
    height: number
  }) => DragSelectionResult
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
  examPageId,
  detectedRects = [],
  detectionMode = "manual",
  onDetectedRectClick,
  onSnapToDetectedRects,
}: ImageCanvasProps) => {
  // Get zoom controls first
  const { zoom, showZoomHelp, setShowZoomHelp, imageContainerRef } =
    useZoomControls()

  const {
    dragging,
    dragStartCoords,
    dragCurrentCoords,
    adjustingArea,
    handlePointerDown,
    handleResizePointerDown,
    handleMovePointerDown,
  } = useImageCanvasInteraction({
    disabled,
    backgroundImageUrl,
    imageDimensions,
    examPageId,
    areas,
    onAddAreaByDrag,
    onUpdateArea,
    zoom,
    imageContainerRef: imageContainerRef as React.RefObject<HTMLDivElement>,
    detectionMode,
    onSnapToDetectedRects,
  })

  useKeyboardShortcuts(selectedAreaIndex, onDeleteArea)

  // 掴んでいる間は、その領域だけ手元の姿に差し替えて描く。DB にはまだ書いて
  // いないので、`areas` は掴む前の姿のままである
  const shownAreas = useMemo(
    () =>
      adjustingArea === null
        ? areas
        : areas.map((area, index) =>
            index === adjustingArea.areaIndex
              ? { ...area, ...adjustingArea.coords }
              : area
          ),
    [areas, adjustingArea]
  )

  // Calculate image dimensions based on zoom
  const imageDimensionsWithZoom = useMemo(
    () => ({
      width: imageDimensions ? imageDimensions.width * zoom : 0,
      height: imageDimensions ? imageDimensions.height * zoom : 0,
    }),
    [imageDimensions, zoom]
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
          onPointerDown={handlePointerDown}
        >
          {/* 検出枠オーバーレイ（確定済み領域より下に表示） */}
          <DetectedRectOverlay
            detectedRects={detectedRects}
            imageDimensions={imageDimensions}
            zoom={zoom}
            visible={detectionMode !== "manual"}
            onRectClick={onDetectedRectClick}
          />

          <AreaRenderer
            areas={shownAreas}
            selectedAreaIndex={selectedAreaIndex}
            onSelectArea={onSelectArea}
            onResizePointerDown={handleResizePointerDown}
            onMovePointerDown={handleMovePointerDown}
            imageDimensions={imageDimensions}
            containerRef={imageContainerRef}
            zoom={zoom}
          />

          <DragPreview
            dragging={dragging}
            dragStartCoords={dragStartCoords}
            dragCurrentCoords={dragCurrentCoords}
            imageDimensions={imageDimensions}
            containerRef={imageContainerRef}
            zoom={zoom}
          />
        </div>
      </div>
    </div>
  )
}

export default ImageCanvas
