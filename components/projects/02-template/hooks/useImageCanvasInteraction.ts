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
import {
  DragState,
  MoveState,
  ResizeState,
  UseImageCanvasInteractionProps,
} from "@/components/projects/02-template/types"
import { useCanvasCoordinates } from "./useCanvasCoordinates"
import { useMouseHandlers } from "./useMouseHandlers"

export function useImageCanvasInteraction({
  disabled,
  backgroundImageUrl,
  imageDimensions,
  projectPageId,
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

  // Coordinate calculations
  const { getRelativeCoords } = useCanvasCoordinates(imageDimensions, zoom)

  // Mouse event handlers
  const {
    handleMouseDown,
    handleResizeMouseDown,
    handleMoveMouseDown,
    handleMouseMove,
    handleMouseUp,
  } = useMouseHandlers({
    disabled,
    backgroundImageUrl,
    imageDimensions,
    projectPageId,
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
    setDragging,
    setDragStartCoords,
    setDragCurrentCoords,
    setResizing,
    setMoving,
    detectionMode,
    onSnapToDetectedRects,
  })

  // Event listeners setup
  useEffect(() => {
    if (dragging || resizing || moving) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)

      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [dragging, resizing, moving, handleMouseMove, handleMouseUp])

  return {
    dragging,
    dragStartCoords,
    dragCurrentCoords,
    handleMouseDown,
    handleResizeMouseDown,
    handleMoveMouseDown,
  }
}
