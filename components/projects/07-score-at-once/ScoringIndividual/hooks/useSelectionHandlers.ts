import type {
  DrawingElement,
  SelectionRectangle,
} from "@/components/projects/07-score-at-once/ScoringIndividual/types/answer-individual-types"
import { useCallback } from "react"

interface UseSelectionHandlersProps {
  currentTool: string
  drawingElements: DrawingElement[]
  selectedElementIds: string[]
  isDraggingElement: boolean
  isDrawingSelection: boolean
  selectionRectangle: SelectionRectangle | null
  isCtrlPressed: boolean
  lineEditMode: any
  dragElementOffset: { x: number; y: number }

  // Actions
  toggleSelection: (id: string) => void
  setSelectedElementIds: (ids: string[]) => void
  clearSelection: () => void
  setIsDrawingSelection: (drawing: boolean) => void
  setSelectionRectangle: (rect: SelectionRectangle | null) => void
  selectElementsInRectangle: (rect: SelectionRectangle) => void
  setIsDraggingElement: (dragging: boolean) => void
  setDragElementOffset: (offset: { x: number; y: number }) => void
  setLineEditMode: (mode: any) => void
  setRectangleEditMode: (mode: any) => void
  updateDrawingElement: (id: string, updates: any) => void

  // Utils
  hitTestElement: (element: any, x: number, y: number) => boolean
  getLineEditMode: (element: any, x: number, y: number) => any
  getRectangleEditMode: (element: any, x: number, y: number) => any
}

export function useSelectionHandlers({
  currentTool,
  drawingElements,
  selectedElementIds,
  isDraggingElement,
  isDrawingSelection,
  selectionRectangle,
  isCtrlPressed,
  lineEditMode,
  dragElementOffset,
  toggleSelection,
  setSelectedElementIds,
  clearSelection,
  setIsDrawingSelection,
  setSelectionRectangle,
  selectElementsInRectangle,
  setIsDraggingElement,
  setDragElementOffset,
  setLineEditMode,
  setRectangleEditMode,
  updateDrawingElement,
  hitTestElement,
  getLineEditMode,
  getRectangleEditMode,
}: UseSelectionHandlersProps) {
  // 選択ツールのマウスダウン処理
  const handleSelectionMouseDown = useCallback(
    (imageCoords: { x: number; y: number }) => {
      if (currentTool !== "select") return false

      // 既存要素の選択チェック
      let elementSelected = false
      let clickedElement: any = null

      for (let i = drawingElements.length - 1; i >= 0; i--) {
        const element = drawingElements[i]
        if (hitTestElement(element, imageCoords.x, imageCoords.y)) {
          clickedElement = element
          elementSelected = true
          break
        }
      }

      if (elementSelected && clickedElement) {
        // Ctrl/Cmdキーが押されている場合は複数選択
        if (isCtrlPressed) {
          toggleSelection(clickedElement.id)
        } else {
          // 既に選択されている要素をクリックした場合はそのまま維持
          if (selectedElementIds.includes(clickedElement.id)) {
            // 何もしない（現在の選択を維持）
          } else {
            // 新しい要素を単独選択
            setSelectedElementIds([clickedElement.id])
          }
        }

        // 編集モードの判定（最初の選択要素のみ）
        const firstSelectedId = selectedElementIds[0] || clickedElement.id
        const firstSelectedElement = drawingElements.find(
          (el) => el.id === firstSelectedId,
        )

        if (firstSelectedElement?.type === "line") {
          const editMode = getLineEditMode(
            firstSelectedElement,
            imageCoords.x,
            imageCoords.y,
          )
          setLineEditMode(editMode)
        } else if (firstSelectedElement?.type === "rectangle") {
          const editMode = getRectangleEditMode(
            firstSelectedElement,
            imageCoords.x,
            imageCoords.y,
          )
          setRectangleEditMode(editMode)
        }

        // ドラッグ開始
        setIsDraggingElement(true)
        setDragElementOffset({
          x: imageCoords.x - clickedElement.x,
          y: imageCoords.y - clickedElement.y,
        })
      } else {
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
      }
      return true
    },
    [
      currentTool,
      drawingElements,
      selectedElementIds,
      isCtrlPressed,
      hitTestElement,
      toggleSelection,
      setSelectedElementIds,
      clearSelection,
      setIsDrawingSelection,
      setSelectionRectangle,
      getLineEditMode,
      setLineEditMode,
      getRectangleEditMode,
      setRectangleEditMode,
      setIsDraggingElement,
      setDragElementOffset,
    ],
  )

  // 選択ツールのマウス移動処理
  const handleSelectionMouseMove = useCallback(
    (imageCoords: { x: number; y: number }) => {
      if (currentTool !== "select") return false

      // 要素のドラッグ処理（複数選択対応）
      if (isDraggingElement && selectedElementIds.length > 0) {
        const firstElementId = selectedElementIds[0]
        const firstElement = drawingElements.find(
          (el) => el.id === firstElementId,
        )

        if (firstElement) {
          if (firstElement.type === "line" && lineEditMode) {
            // 線の編集（最初の要素のみ）
            if (lineEditMode === "start") {
              updateDrawingElement(firstElementId, {
                x: imageCoords.x,
                y: imageCoords.y,
              })
            } else if (lineEditMode === "end") {
              updateDrawingElement(firstElementId, {
                endX: imageCoords.x,
                endY: imageCoords.y,
              })
            } else if (lineEditMode === "move") {
              const deltaX =
                imageCoords.x - dragElementOffset.x - firstElement.x
              const deltaY =
                imageCoords.y - dragElementOffset.y - firstElement.y

              // 全選択要素を同じ量だけ移動
              selectedElementIds.forEach((elementId) => {
                const element = drawingElements.find(
                  (el) => el.id === elementId,
                )
                if (element) {
                  if (
                    element.type === "line" &&
                    element.endX !== undefined &&
                    element.endY !== undefined
                  ) {
                    updateDrawingElement(elementId, {
                      x: element.x + deltaX,
                      y: element.y + deltaY,
                      endX: element.endX + deltaX,
                      endY: element.endY + deltaY,
                    })
                  } else {
                    updateDrawingElement(elementId, {
                      x: element.x + deltaX,
                      y: element.y + deltaY,
                    })
                  }
                }
              })
            }
          } else {
            // 通常の移動（全選択要素を移動）
            const deltaX = imageCoords.x - dragElementOffset.x - firstElement.x
            const deltaY = imageCoords.y - dragElementOffset.y - firstElement.y

            selectedElementIds.forEach((elementId) => {
              const element = drawingElements.find((el) => el.id === elementId)
              if (element) {
                if (
                  element.type === "line" &&
                  element.endX !== undefined &&
                  element.endY !== undefined
                ) {
                  updateDrawingElement(elementId, {
                    x: element.x + deltaX,
                    y: element.y + deltaY,
                    endX: element.endX + deltaX,
                    endY: element.endY + deltaY,
                  })
                } else {
                  updateDrawingElement(elementId, {
                    x: element.x + deltaX,
                    y: element.y + deltaY,
                  })
                }
              }
            })
          }
        }
        return true
      }

      // 選択範囲ドラッグ処理
      if (isDrawingSelection && selectionRectangle) {
        const width = imageCoords.x - selectionRectangle.x
        const height = imageCoords.y - selectionRectangle.y

        setSelectionRectangle({
          ...selectionRectangle,
          width,
          height,
        })
        return true
      }

      return false
    },
    [
      currentTool,
      isDraggingElement,
      selectedElementIds,
      drawingElements,
      lineEditMode,
      dragElementOffset.x,
      dragElementOffset.y,
      updateDrawingElement,
      isDrawingSelection,
      selectionRectangle,
      setSelectionRectangle,
    ],
  )

  // 選択ツールのマウスアップ処理
  const handleSelectionMouseUp = useCallback(() => {
    if (currentTool !== "select") return false

    let handled = false

    if (isDraggingElement) {
      setIsDraggingElement(false)
      setLineEditMode(null)
      setRectangleEditMode(null)
      handled = true
    }

    // 選択範囲ドラッグ完了処理
    if (isDrawingSelection && selectionRectangle) {
      setIsDrawingSelection(false)

      // 選択範囲に含まれる要素を選択
      if (
        Math.abs(selectionRectangle.width) > 0.01 ||
        Math.abs(selectionRectangle.height) > 0.01
      ) {
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
    isDraggingElement,
    isDrawingSelection,
    selectionRectangle,
    selectedElementIds,
    isCtrlPressed,
    drawingElements,
    setIsDraggingElement,
    setLineEditMode,
    setRectangleEditMode,
    setIsDrawingSelection,
    setSelectedElementIds,
    selectElementsInRectangle,
    setSelectionRectangle,
  ])

  return {
    handleSelectionMouseDown,
    handleSelectionMouseMove,
    handleSelectionMouseUp,
  }
}
