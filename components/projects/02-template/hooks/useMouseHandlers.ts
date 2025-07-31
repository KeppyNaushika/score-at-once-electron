/**
 * Mouse event handlers for canvas interactions
 */

import { MouseEvent as ReactMouseEvent, useCallback, useRef } from "react"
import { DragState, MoveState, ResizeState } from "@/components/projects/02-template/types"

/**
 * Custom hook for handling mouse events on the canvas
 *
 * @param params - Configuration parameters for mouse handling
 * @returns Object containing mouse event handlers
 */
export function useMouseHandlers({
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
}: {
  disabled: boolean
  backgroundImageUrl: string | null
  imageDimensions: { width: number; height: number } | null
  projectPageId: string | null
  areas: any[]
  onAddAreaByDrag: (
    type: import("@/types/common.types").CropRegionAreaType,
    coords: { x: number; y: number; width: number; height: number },
  ) => void
  onUpdateArea: (
    index: number,
    coords: { x: number; y: number; width: number; height: number },
  ) => void
  getRelativeCoords: (
    clientX: number,
    clientY: number,
    ref: React.RefObject<HTMLDivElement>,
  ) => { x: number; y: number }
  imageContainerRef: React.RefObject<HTMLDivElement>
  dragging: boolean
  dragStartCoords: DragState | null
  dragCurrentCoords: DragState | null
  resizing: ResizeState | null
  moving: MoveState | null
  setDragging: (value: boolean) => void
  setDragStartCoords: (value: DragState | null) => void
  setDragCurrentCoords: (value: DragState | null) => void
  setResizing: (value: ResizeState | null) => void
  setMoving: (value: MoveState | null) => void
}) {
  const isCreatingRef = useRef(false) // 重複作成防止

  /**
   * Handle mouse down events for starting drag operations
   *
   * @param event - React mouse event
   */
  const handleMouseDown = (
    event: ReactMouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    if (
      disabled ||
      !backgroundImageUrl ||
      !imageDimensions ||
      !imageContainerRef.current ||
      !projectPageId
    )
      return

    const coords = getRelativeCoords(
      event.clientX,
      event.clientY,
      imageContainerRef,
    )

    setDragStartCoords(coords)
    setDragCurrentCoords(coords)
    setDragging(true)
  }

  /**
   * Handle mouse down events for starting resize operations
   *
   * @param event - React mouse event
   * @param areaIndex - Index of the area being resized
   * @param handle - Which resize handle was clicked
   */
  const handleResizeMouseDown = (
    event: ReactMouseEvent<HTMLDivElement, MouseEvent>,
    areaIndex: number,
    handle: "nw" | "ne" | "sw" | "se",
  ) => {
    event.stopPropagation()
    if (!imageContainerRef.current) return

    const coords = getRelativeCoords(
      event.clientX,
      event.clientY,
      imageContainerRef,
    )
    const area = areas[areaIndex]

    setResizing({
      areaIndex,
      handle,
      startCoords: coords,
      originalArea: {
        x: area.x,
        y: area.y,
        width: area.width,
        height: area.height,
      },
    })
  }

  /**
   * Handle mouse down events for starting move operations
   *
   * @param event - React mouse event
   * @param areaIndex - Index of the area being moved
   */
  const handleMoveMouseDown = (
    event: ReactMouseEvent<HTMLDivElement, MouseEvent>,
    areaIndex: number,
  ) => {
    event.stopPropagation()
    if (!imageContainerRef.current) return

    const coords = getRelativeCoords(
      event.clientX,
      event.clientY,
      imageContainerRef,
    )
    const area = areas[areaIndex]

    setMoving({
      areaIndex,
      startCoords: coords,
      originalArea: {
        x: area.x,
        y: area.y,
        width: area.width,
        height: area.height,
      },
    })
  }

  /**
   * Handle mouse move events for drag, resize, and move operations
   *
   * @param event - Mouse event
   */
  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!imageContainerRef.current) return

      const coords = getRelativeCoords(
        event.clientX,
        event.clientY,
        imageContainerRef,
      )

      if (dragging && dragStartCoords) {
        setDragCurrentCoords(coords)
      } else if (resizing) {
        const { areaIndex, handle, startCoords, originalArea } = resizing
        const deltaX = coords.x - startCoords.x
        const deltaY = coords.y - startCoords.y

        let newArea = { ...originalArea }

        switch (handle) {
          case "nw":
            newArea.x = originalArea.x + deltaX
            newArea.y = originalArea.y + deltaY
            newArea.width = originalArea.width - deltaX
            newArea.height = originalArea.height - deltaY
            break
          case "ne":
            newArea.y = originalArea.y + deltaY
            newArea.width = originalArea.width + deltaX
            newArea.height = originalArea.height - deltaY
            break
          case "sw":
            newArea.x = originalArea.x + deltaX
            newArea.width = originalArea.width - deltaX
            newArea.height = originalArea.height + deltaY
            break
          case "se":
            newArea.width = originalArea.width + deltaX
            newArea.height = originalArea.height + deltaY
            break
        }

        // Ensure minimum size and bounds
        newArea.width = Math.max(0.02, newArea.width)
        newArea.height = Math.max(0.02, newArea.height)
        newArea.x = Math.max(0, Math.min(1 - newArea.width, newArea.x))
        newArea.y = Math.max(0, Math.min(1 - newArea.height, newArea.y))

        onUpdateArea(areaIndex, newArea)
      } else if (moving) {
        const { areaIndex, startCoords, originalArea } = moving
        const deltaX = coords.x - startCoords.x
        const deltaY = coords.y - startCoords.y

        const newArea = {
          ...originalArea,
          x: Math.max(
            0,
            Math.min(1 - originalArea.width, originalArea.x + deltaX),
          ),
          y: Math.max(
            0,
            Math.min(1 - originalArea.height, originalArea.y + deltaY),
          ),
        }

        onUpdateArea(areaIndex, newArea)
      }
    },
    [
      dragging,
      dragStartCoords,
      resizing,
      moving,
      getRelativeCoords,
      onUpdateArea,
      imageContainerRef,
      setDragCurrentCoords,
    ],
  )

  /**
   * Handle mouse up events to complete drag, resize, and move operations
   */
  const handleMouseUp = useCallback(() => {
    // 即座な重複防止チェック（デバウンシング機構）
    if (isCreatingRef.current) {
      return
    }

    // 重複作成を防ぐため、draggingがtrueかつ作成中でない時のみ実行
    if (dragging && dragStartCoords && dragCurrentCoords) {
      // 即座に重複防止フラグを設定
      isCreatingRef.current = true

      const startX = Math.min(dragStartCoords.x, dragCurrentCoords.x)
      const startY = Math.min(dragStartCoords.y, dragCurrentCoords.y)
      const width = Math.abs(dragCurrentCoords.x - dragStartCoords.x)
      const height = Math.abs(dragCurrentCoords.y - dragStartCoords.y)

      // 重複防止のため、先にstateをリセット
      setDragging(false)
      setDragStartCoords(null)
      setDragCurrentCoords(null)

      // Only create area if drag is large enough
      if (width > 0.01 && height > 0.01) {
        onAddAreaByDrag("QUESTION_ANSWER", {
          x: startX,
          y: startY,
          width,
          height,
        })
      }

      // 即座にフラグをリセット（setTimeoutは不要）
      isCreatingRef.current = false
    } else {
      // draggingでない場合も確実にリセット
      setDragging(false)
      setDragStartCoords(null)
      setDragCurrentCoords(null)
    }

    setResizing(null)
    setMoving(null)
  }, [
    dragging,
    dragStartCoords,
    dragCurrentCoords,
    onAddAreaByDrag,
    setDragCurrentCoords,
    setDragStartCoords,
    setDragging,
    setMoving,
    setResizing,
  ])

  return {
    handleMouseDown,
    handleResizeMouseDown,
    handleMoveMouseDown,
    handleMouseMove,
    handleMouseUp,
  }
}
