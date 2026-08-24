import { useState } from "react"

import type { CropRegionRow } from "@/queries/cropRegion"

type DragState = {
  draggedIndex: number | null
  dragOverIndex: number | null
}

type UseDragAndDropProps = {
  regions: CropRegionRow[]
  /** 並べ替えた結果をそのまま渡す（書き込みは呼び出し側が持つ） */
  onReorder: (reordered: CropRegionRow[]) => void
}

/** 領域情報テーブルの行ドラッグ&ドロップによる並び替えを管理するフック */
export const useDragAndDrop = ({ regions, onReorder }: UseDragAndDropProps) => {
  const [dragState, setDragState] = useState<DragState>({
    draggedIndex: null,
    dragOverIndex: null,
  })

  const handleDragStart = (index: number) => {
    setDragState({ draggedIndex: index, dragOverIndex: null })
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragState.draggedIndex !== null && dragState.draggedIndex !== index) {
      setDragState((prev) => ({ ...prev, dragOverIndex: index }))
    }
  }

  const handleDragLeave = () => {
    setDragState((prev) => ({ ...prev, dragOverIndex: null }))
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    const { draggedIndex } = dragState

    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      const reordered = [...regions]
      const draggedItem = reordered[draggedIndex]

      reordered.splice(draggedIndex, 1)
      reordered.splice(dropIndex, 0, draggedItem)

      onReorder(
        reordered.map((region, index) => ({ ...region, orderIndex: index }))
      )
      // 選択は採点領域の id で持っているので、並びが変わっても指す先は変わらない
      // （添字で持っていた頃はここで付け替えが要った）
    }

    setDragState({ draggedIndex: null, dragOverIndex: null })
  }

  const handleDragEnd = () => {
    setDragState({ draggedIndex: null, dragOverIndex: null })
  }

  return {
    dragState,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
  }
}
