import { useState } from "react"
import type { LayoutRegionWithDetails } from "@/types/electron"

type DragState = {
  draggedIndex: number | null
  dragOverIndex: number | null
}

type UseDragAndDropProps = {
  regions: LayoutRegionWithDetails[]
  setRegions: React.Dispatch<React.SetStateAction<LayoutRegionWithDetails[]>>
  selectedRowIndex: number | null
  setSelectedRowIndex: React.Dispatch<React.SetStateAction<number | null>>
}

export const useDragAndDrop = ({
  regions,
  setRegions,
  selectedRowIndex,
  setSelectedRowIndex,
}: UseDragAndDropProps) => {
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
      const newRegions = [...regions]
      const draggedItem = newRegions[draggedIndex]

      newRegions.splice(draggedIndex, 1)
      newRegions.splice(dropIndex, 0, draggedItem)
      setRegions(newRegions)
      
      if (selectedRowIndex === draggedIndex) {
        setSelectedRowIndex(dropIndex)
      } else if (selectedRowIndex !== null) {
        if (draggedIndex < selectedRowIndex && dropIndex >= selectedRowIndex) {
          setSelectedRowIndex(selectedRowIndex - 1)
        } else if (
          draggedIndex > selectedRowIndex &&
          dropIndex <= selectedRowIndex
        ) {
          setSelectedRowIndex(selectedRowIndex + 1)
        }
      }
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