import { useState } from "react"

/**
 * グリッド上のドラッグ選択状態（開始位置・現在位置・ドラッグ中フラグ）を管理するフック。
 *
 * 押しただけではドラッグにしない（isDragging は動かしてから立つ）。押した瞬間に
 * ドラッグにすると、離したときに押した答案1つの範囲で選択を置き換えてしまい、
 * Shift/Ctrl+クリックで広げた選択が消える
 */
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
    setDragCurrent({ x, y })
  }

  const updateDrag = (x: number, y: number) => {
    setIsDragging(true)
    setDragCurrent({ x, y })
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
