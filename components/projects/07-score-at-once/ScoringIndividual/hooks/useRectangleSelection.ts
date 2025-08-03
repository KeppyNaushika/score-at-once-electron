import type {
  DrawingElement,
  SelectionRectangle,
} from "@/components/projects/07-score-at-once/ScoringIndividual/types/answer-individual-types"
import { useCallback } from "react"

interface UseRectangleSelectionProps {
  currentTool: string
  drawingElements: DrawingElement[]
  selectedElementIds: string[]
  isDrawingSelection: boolean
  selectionRectangle: SelectionRectangle | null
  isCtrlPressed: boolean

  // Actions
  clearSelection: () => void
  setIsDrawingSelection: (drawing: boolean) => void
  setSelectionRectangle: (rect: SelectionRectangle | null) => void
  selectElementsInRectangle: (rect: SelectionRectangle) => void
  setSelectedElementIds: (ids: string[]) => void
  setLineEditMode: (mode: any) => void
  setRectangleEditMode: (mode: any) => void
}

export function useRectangleSelection({
  currentTool,
  drawingElements,
  selectedElementIds,
  isDrawingSelection,
  selectionRectangle,
  isCtrlPressed,
  clearSelection,
  setIsDrawingSelection,
  setSelectionRectangle,
  selectElementsInRectangle,
  setSelectedElementIds,
  setLineEditMode,
  setRectangleEditMode,
}: UseRectangleSelectionProps) {
  // 長方形選択開始
  const startRectangleSelection = useCallback(
    (imageCoords: { x: number; y: number }) => {
      if (currentTool !== "select") return false

      console.log("📐 長方形選択開始:", imageCoords)
      console.log("📐 現在の状態:", {
        isCtrlPressed,
        selectedElementIds: selectedElementIds.length,
        isDrawingSelection,
      })

      // 何も選択されなかった場合は選択範囲ドラッグを開始
      if (!isCtrlPressed) {
        clearSelection()
      }

      // 選択範囲ドラッグ開始
      setIsDrawingSelection(true)
      setSelectionRectangle({
        x: imageCoords.x,
        y: imageCoords.y,
        width: 0,
        height: 0,
      })
      setLineEditMode(null)
      setRectangleEditMode(null)

      return true
    },
    [
      currentTool,
      isCtrlPressed,
      selectedElementIds.length,
      isDrawingSelection,
      setIsDrawingSelection,
      setSelectionRectangle,
      setLineEditMode,
      setRectangleEditMode,
      clearSelection,
    ],
  )

  // 長方形選択の更新
  const updateRectangleSelection = useCallback(
    (imageCoords: { x: number; y: number }) => {
      if (
        currentTool !== "select" ||
        !isDrawingSelection ||
        !selectionRectangle
      ) {
        return false
      }

      const width = imageCoords.x - selectionRectangle.x
      const height = imageCoords.y - selectionRectangle.y

      setSelectionRectangle({
        ...selectionRectangle,
        width,
        height,
      })
      return true
    },
    [
      currentTool,
      isDrawingSelection,
      selectionRectangle,
      setSelectionRectangle,
    ],
  )

  // 長方形選択の完了
  const completeRectangleSelection = useCallback(() => {
    if (currentTool !== "select") return false

    let handled = false

    // 選択範囲ドラッグ完了処理
    if (isDrawingSelection && selectionRectangle) {
      setIsDrawingSelection(false)

      // 選択範囲に含まれる要素を選択
      if (
        Math.abs(selectionRectangle.width) > 0.01 ||
        Math.abs(selectionRectangle.height) > 0.01
      ) {
        console.log("📐 長方形選択完了:", selectionRectangle)

        // Ctrl/Cmdキーで追加選択
        if (isCtrlPressed) {
          const elementsInRect = drawingElements
            .filter((element) => {
              // Use the same overlap detection logic as in the drawing state
              let elementLeft = element.x
              let elementTop = element.y
              let elementRight = element.x
              let elementBottom = element.y

              switch (element.type) {
                case "line":
                  if (
                    element.endX !== undefined &&
                    element.endY !== undefined
                  ) {
                    elementLeft = Math.min(element.x, element.endX)
                    elementTop = Math.min(element.y, element.endY)
                    elementRight = Math.max(element.x, element.endX)
                    elementBottom = Math.max(element.y, element.endY)
                  }
                  break
                case "rectangle":
                  if (
                    element.width !== undefined &&
                    element.height !== undefined
                  ) {
                    elementRight = element.x + element.width
                    elementBottom = element.y + element.height
                  }
                  break
                case "text":
                  if (
                    element.textBoxWidth !== undefined &&
                    element.textBoxHeight !== undefined
                  ) {
                    elementRight = element.x + element.textBoxWidth
                    elementBottom = element.y + element.textBoxHeight
                  } else {
                    elementRight = element.x + 0.05
                    elementBottom = element.y + 0.03
                  }
                  break
              }

              const rectLeft = Math.min(
                selectionRectangle.x,
                selectionRectangle.x + selectionRectangle.width,
              )
              const rectTop = Math.min(
                selectionRectangle.y,
                selectionRectangle.y + selectionRectangle.height,
              )
              const rectRight = Math.max(
                selectionRectangle.x,
                selectionRectangle.x + selectionRectangle.width,
              )
              const rectBottom = Math.max(
                selectionRectangle.y,
                selectionRectangle.y + selectionRectangle.height,
              )

              return !(
                elementRight < rectLeft ||
                elementLeft > rectRight ||
                elementBottom < rectTop ||
                elementTop > rectBottom
              )
            })
            .map((element) => element.id)

          // 現在の選択に追加
          const newSelection = [...selectedElementIds]
          elementsInRect.forEach((id) => {
            if (!newSelection.includes(id)) {
              newSelection.push(id)
            }
          })
          setSelectedElementIds(newSelection)
        } else {
          // 通常の選択範囲選択
          selectElementsInRectangle(selectionRectangle)
        }
      }

      setSelectionRectangle(null)
      handled = true
    }

    return handled
  }, [
    currentTool,
    isDrawingSelection,
    selectionRectangle,
    selectedElementIds,
    isCtrlPressed,
    drawingElements,
    setIsDrawingSelection,
    setSelectedElementIds,
    selectElementsInRectangle,
    setSelectionRectangle,
  ])

  return {
    startRectangleSelection,
    updateRectangleSelection,
    completeRectangleSelection,
  }
}
