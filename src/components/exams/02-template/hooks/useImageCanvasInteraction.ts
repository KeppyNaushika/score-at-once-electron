/**
 * Main hook for handling image canvas interactions
 *
 * This hook provides functionality for:
 * - Drag to create new regions
 * - Resize existing regions
 * - Move existing regions
 * - Coordinate calculations and transformations
 *
 * @param props - Configuration properties for the interaction hook
 * @returns Object containing interaction state and handlers
 */

"use client"

import { useEffect, useState } from "react"

import type {
  AdjustingArea,
  DragState,
  MoveState,
  RegionCoordinates,
  ResizeState,
  UseImageCanvasInteractionProps,
} from "@/components/exams/02-template/types"

import { useCanvasCoordinates } from "./useCanvasCoordinates"
import { usePointerHandlers } from "./usePointerHandlers"

/** 掴んでいる間の姿と、保存されている姿が同じか */
const isSameCoords = (
  first: RegionCoordinates,
  second: RegionCoordinates
): boolean =>
  first.x === second.x &&
  first.y === second.y &&
  first.width === second.width &&
  first.height === second.height

/** 採点領域の作成・リサイズ・移動などキャンバス上のポインタ操作を管理するフック */
export function useImageCanvasInteraction({
  disabled,
  backgroundImageUrl,
  imageDimensions,
  examPageId,
  areas,
  onAddAreaByDrag,
  onUpdateArea,
  zoom,
  imageContainerRef,
  detectionMode = "manual",
  onSnapToDetectedRects,
}: UseImageCanvasInteractionProps & {
  imageContainerRef: React.RefObject<HTMLDivElement>
}) {
  // State management
  const [dragging, setDragging] = useState(false)
  const [dragStartCoords, setDragStartCoords] = useState<DragState | null>(null)
  const [dragCurrentCoords, setDragCurrentCoords] = useState<DragState | null>(
    null
  )
  const [resizing, setResizing] = useState<ResizeState | null>(null)
  const [moving, setMoving] = useState<MoveState | null>(null)
  /** 掴んでいる間の領域の姿。まだ書いていない */
  const [adjustingArea, setAdjustingArea] = useState<AdjustingArea | null>(null)

  // 書いた姿が返ってきた。手元の覚えは役目を終える。指を離した時点で捨てると、
  // 取り直しが着地するまでの一瞬だけ元の位置へ戻って見える
  const storedArea = adjustingArea ? areas[adjustingArea.areaIndex] : undefined
  if (
    adjustingArea &&
    storedArea &&
    isSameCoords(storedArea, adjustingArea.coords)
  ) {
    setAdjustingArea(null)
  }

  // Coordinate calculations
  const { getRelativeCoords } = useCanvasCoordinates(imageDimensions, zoom)

  // Pointer event handlers
  const {
    handlePointerDown,
    handleResizePointerDown,
    handleMovePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  } = usePointerHandlers({
    disabled,
    backgroundImageUrl,
    imageDimensions,
    examPageId,
    areas,
    onAddAreaByDrag,
    onUpdateArea,
    getRelativeCoords,
    imageContainerRef,
    dragging,
    dragStartCoords,
    dragCurrentCoords,
    resizing,
    moving,
    adjustingArea,
    setDragging,
    setDragStartCoords,
    setDragCurrentCoords,
    setResizing,
    setMoving,
    setAdjustingArea,
    detectionMode,
    onSnapToDetectedRects,
  })

  // Event listeners setup
  useEffect(() => {
    if (dragging || resizing || moving) {
      document.addEventListener("pointermove", handlePointerMove)
      document.addEventListener("pointerup", handlePointerUp)
      document.addEventListener("pointercancel", handlePointerCancel)

      return () => {
        document.removeEventListener("pointermove", handlePointerMove)
        document.removeEventListener("pointerup", handlePointerUp)
        document.removeEventListener("pointercancel", handlePointerCancel)
      }
    }
  }, [
    dragging,
    resizing,
    moving,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
  ])

  return {
    dragging,
    dragStartCoords,
    dragCurrentCoords,
    adjustingArea,
    handlePointerDown,
    handleResizePointerDown,
    handleMovePointerDown,
  }
}
