import { useState } from "react"

/** グリッド上のドラッグ選択状態（開始位置・現在位置・ドラッグ中フラグ）を管理するフック */
export function useGridSelection() {
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
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

  return {
    dragStart,
    isDragging,
    dragCurrent,
    startDrag,
    updateDrag,
    endDrag,
  }
}
