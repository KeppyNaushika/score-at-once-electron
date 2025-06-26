"use client"

import { AreaType } from "@prisma/client"
import { MouseEvent as ReactMouseEvent, useCallback, useEffect, useRef, useState } from "react"

interface DragState {
  x: number
  y: number
}

interface ResizeState {
  areaIndex: number
  handle: "nw" | "ne" | "sw" | "se"
  startCoords: { x: number; y: number }
  originalArea: { x: number; y: number; width: number; height: number }
}

interface MoveState {
  areaIndex: number
  startCoords: { x: number; y: number }
  originalArea: { x: number; y: number; width: number; height: number }
}

interface UseImageCanvasInteractionProps {
  disabled: boolean
  backgroundImageUrl: string | null
  imageDimensions: { width: number; height: number } | null
  masterImageId: string | null
  areas: any[]
  onAddAreaByDrag: (
    type: AreaType,
    coords: { x: number; y: number; width: number; height: number },
  ) => void
  onUpdateArea: (
    index: number,
    coords: { x: number; y: number; width: number; height: number },
  ) => void
  zoom: number
}

export function useImageCanvasInteraction({
  disabled,
  backgroundImageUrl,
  imageDimensions,
  masterImageId,
  areas,
  onAddAreaByDrag,
  onUpdateArea,
  zoom,
}: UseImageCanvasInteractionProps) {
  const [dragging, setDragging] = useState(false)
  const [dragStartCoords, setDragStartCoords] = useState<DragState | null>(null)
  const [dragCurrentCoords, setDragCurrentCoords] = useState<DragState | null>(null)
  const [resizing, setResizing] = useState<ResizeState | null>(null)
  const [moving, setMoving] = useState<MoveState | null>(null)
  const imageContainerRef = useRef<HTMLDivElement>(null)
  const isCreatingRef = useRef(false) // 重複作成防止

  const getImageBounds = useCallback(() => {
    if (!imageContainerRef.current || !imageDimensions) return null

    // 標準スクロール方式：画像コンテナのサイズがそのまま画像サイズ
    const scaledImageWidth = imageDimensions.width * zoom
    const scaledImageHeight = imageDimensions.height * zoom

    return {
      left: 0,
      top: 0,
      width: scaledImageWidth,
      height: scaledImageHeight,
    }
  }, [imageDimensions, zoom])

  const getRelativeCoords = useCallback((clientX: number, clientY: number) => {
    if (!imageContainerRef.current) return { x: 0, y: 0 }

    const containerRect = imageContainerRef.current.getBoundingClientRect()
    const imageBounds = getImageBounds()
    
    if (!imageBounds) return { x: 0, y: 0 }

    // 標準スクロール方式：コンテナの左上角が画像の原点
    const x = (clientX - containerRect.left) / imageBounds.width
    const y = (clientY - containerRect.top) / imageBounds.height

    return {
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    }
  }, [getImageBounds])

  const handleMouseDown = (event: ReactMouseEvent<HTMLDivElement, MouseEvent>) => {
    if (
      disabled ||
      !backgroundImageUrl ||
      !imageDimensions ||
      !imageContainerRef.current ||
      !masterImageId
    )
      return

    const coords = getRelativeCoords(event.clientX, event.clientY)
    
    setDragStartCoords(coords)
    setDragCurrentCoords(coords)
    setDragging(true)
  }

  const handleResizeMouseDown = (
    event: ReactMouseEvent<HTMLDivElement, MouseEvent>,
    areaIndex: number,
    handle: "nw" | "ne" | "sw" | "se",
  ) => {
    event.stopPropagation()
    if (!imageContainerRef.current) return

    const coords = getRelativeCoords(event.clientX, event.clientY)
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

  const handleMoveMouseDown = (
    event: ReactMouseEvent<HTMLDivElement, MouseEvent>,
    areaIndex: number,
  ) => {
    event.stopPropagation()
    if (!imageContainerRef.current) return

    const coords = getRelativeCoords(event.clientX, event.clientY)
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

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!imageContainerRef.current) return

    const coords = getRelativeCoords(event.clientX, event.clientY)

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
        x: Math.max(0, Math.min(1 - originalArea.width, originalArea.x + deltaX)),
        y: Math.max(0, Math.min(1 - originalArea.height, originalArea.y + deltaY)),
      }

      onUpdateArea(areaIndex, newArea)
    }
  }, [dragging, dragStartCoords, resizing, moving, onUpdateArea, getRelativeCoords])

  const handleMouseUp = useCallback(() => {
    // 重複作成を防ぐため、draggingがtrueかつ作成中でない時のみ実行
    if (dragging && dragStartCoords && dragCurrentCoords && !isCreatingRef.current) {
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
        // 重複防止フラグを設定
        isCreatingRef.current = true
        
        onAddAreaByDrag(AreaType.QUESTION_ANSWER, {
          x: startX,
          y: startY,
          width,
          height,
        })
        
        // 少し遅らせてフラグをリセット
        setTimeout(() => {
          isCreatingRef.current = false
        }, 100)
      }
    } else {
      // draggingでない場合も確実にリセット
      setDragging(false)
      setDragStartCoords(null)
      setDragCurrentCoords(null)
    }

    setResizing(null)
    setMoving(null)
  }, [dragging, dragStartCoords, dragCurrentCoords, onAddAreaByDrag])

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
    imageContainerRef,
    handleMouseDown,
    handleResizeMouseDown,
    handleMoveMouseDown,
  }
}