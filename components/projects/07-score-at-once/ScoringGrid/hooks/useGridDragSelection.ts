import type { GridAnswerItem } from "@/components/projects/07-score-at-once/ScoringGrid/types/gridTypes"
import { RefObject } from "react"

interface UseGridDragSelectionProps {
  gridRef: RefObject<HTMLDivElement | null>
  onAnswerSelect: (id: string, isSelected: boolean) => void
  onReplaceSelection?: (ids: string[]) => void
  selectedAnswers: Set<string>
  sortedAnswers: () => GridAnswerItem[]
}

export function useGridDragSelection({
  gridRef,
  onAnswerSelect,
  onReplaceSelection,
  selectedAnswers,
  sortedAnswers,
}: UseGridDragSelectionProps) {
  const handleMouseDown = (event: React.MouseEvent, answerId: string) => {
    if (answerId.startsWith("master-")) {
      event.preventDefault()
      return
    }

    if (event.ctrlKey) {
      event.preventDefault()
      onAnswerSelect(answerId, !selectedAnswers.has(answerId))
    } else if (event.shiftKey) {
      event.preventDefault()
      handleShiftSelect(answerId)
    } else {
      if (!selectedAnswers.has(answerId)) {
        selectedAnswers.forEach((id) => onAnswerSelect(id, false))
        onAnswerSelect(answerId, true)
      }
    }
  }

  const handleShiftSelect = (endAnswerId: string) => {
    const answers = sortedAnswers()
    if (answers.length === 0) return

    let startIndex = -1
    for (let i = 0; i < answers.length; i++) {
      if (selectedAnswers.has(answers[i].id)) {
        startIndex = i
        break
      }
    }

    const endIndex = answers.findIndex((answer) => answer.id === endAnswerId)

    if (startIndex === -1 || endIndex === -1) {
      onAnswerSelect(endAnswerId, true)
      return
    }

    const minIndex = Math.min(startIndex, endIndex)
    const maxIndex = Math.max(startIndex, endIndex)

    for (let i = minIndex; i <= maxIndex; i++) {
      if (i < answers.length) {
        onAnswerSelect(answers[i].id, true)
      }
    }
  }

  const getDragSelectionRect = (
    dragStart: { x: number; y: number } | null,
    dragCurrent: { x: number; y: number } | null
  ) => {
    if (!dragStart || !dragCurrent || !gridRef.current) return null

    const scrollLeft = gridRef.current.scrollLeft
    const scrollTop = gridRef.current.scrollTop

    const startX = Math.min(dragStart.x, dragCurrent.x) + scrollLeft
    const endX = Math.max(dragStart.x, dragCurrent.x) + scrollLeft
    const startY = Math.min(dragStart.y, dragCurrent.y) + scrollTop
    const endY = Math.max(dragStart.y, dragCurrent.y) + scrollTop

    return {
      left: startX,
      top: startY,
      width: endX - startX,
      height: endY - startY,
    }
  }

  const handleDragSelection = (
    event: React.MouseEvent,
    dragStart: { x: number; y: number } | null
  ) => {
    if (!dragStart || !gridRef.current) return

    const gridElement = gridRef.current
    const gridRect = gridElement.getBoundingClientRect()

    const currentX = event.clientX - gridRect.left
    const currentY = event.clientY - gridRect.top

    const startX = Math.min(dragStart.x, currentX)
    const endX = Math.max(dragStart.x, currentX)
    const startY = Math.min(dragStart.y, currentY)
    const endY = Math.max(dragStart.y, currentY)

    const cardElements = gridElement.querySelectorAll("[data-answer-id]")
    const selectedIds: string[] = []

    cardElements.forEach((cardElement) => {
      const rect = cardElement.getBoundingClientRect()
      const relativeRect = {
        left: rect.left - gridRect.left,
        right: rect.right - gridRect.left,
        top: rect.top - gridRect.top,
        bottom: rect.bottom - gridRect.top,
      }

      if (
        relativeRect.left < endX &&
        relativeRect.right > startX &&
        relativeRect.top < endY &&
        relativeRect.bottom > startY
      ) {
        const answerId = cardElement.getAttribute("data-answer-id")
        if (answerId) {
          selectedIds.push(answerId)
        }
      }
    })

    const uniqueSelectedIds = Array.from(new Set(selectedIds)).filter(
      (id) => !id.startsWith("master-")
    )

    if (uniqueSelectedIds.length > 0) {
      if (onReplaceSelection) {
        onReplaceSelection(uniqueSelectedIds)
      } else {
        selectedAnswers.forEach((id) => onAnswerSelect(id, false))
        uniqueSelectedIds.forEach((id) => onAnswerSelect(id, true))
      }
    } else if (onReplaceSelection) {
      onReplaceSelection([])
    }
  }

  return {
    handleMouseDown,
    getDragSelectionRect,
    handleDragSelection,
  }
}
