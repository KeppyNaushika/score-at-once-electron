import { useState } from "react"

export interface DragState {
  dragStart: { x: number; y: number } | null
  isDragging: boolean
  dragCurrent: { x: number; y: number } | null
}

export function useGridSelection() {
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null,
  )
  const [isDragging, setIsDragging] = useState(false)
  const [dragCurrent, setDragCurrent] = useState<{
    x: number
    y: number
  } | null>(null)

  const startDrag = (x: number, y: number) => {
    setDragStart({ x, y })
    setIsDragging(true)
    setDragCurrent({ x, y })
  }

  const updateDrag = (x: number, y: number) => {
    if (isDragging) {
      setDragCurrent({ x, y })
    }
  }

  const endDrag = () => {
    setDragStart(null)
    setIsDragging(false)
    setDragCurrent(null)
  }

  const resetDrag = () => {
    setDragStart(null)
    setIsDragging(false)
    setDragCurrent(null)
  }

  return {
    dragStart,
    isDragging,
    dragCurrent,
    startDrag,
    updateDrag,
    endDrag,
    resetDrag,
  }
}