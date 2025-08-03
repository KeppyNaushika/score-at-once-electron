import { useCallback } from "react"
import type { DrawingElement } from "@/components/projects/07-score-at-once/ScoringIndividual/types/answer-individual-types"

interface UseElementMovementProps {
  currentTool: string
  drawingElements: DrawingElement[]
  selectedElementIds: string[]
  isDraggingElement: boolean
  lineEditMode: any
  dragElementOffset: { x: number; y: number }
  
  // Actions
  setIsDraggingElement: (dragging: boolean) => void
  setDragElementOffset: (offset: { x: number; y: number }) => void
  setLineEditMode: (mode: any) => void
  setRectangleEditMode: (mode: any) => void
  updateDrawingElement: (id: string, updates: any) => void
  
  // Utils
  hitTestElement: (element: any, x: number, y: number) => boolean
}

export function useElementMovement({
  currentTool,
  drawingElements,
  selectedElementIds,
  isDraggingElement,
  lineEditMode,
  dragElementOffset,
  setIsDraggingElement,
  setDragElementOffset,
  setLineEditMode,
  setRectangleEditMode,
  updateDrawingElement,
  hitTestElement,
}: UseElementMovementProps) {
  
  // 要素移動の開始チェック（マウスダウン時のみ実行される想定）
  const checkMovementStart = useCallback(
    (imageCoords: { x: number; y: number }) => {
      console.log("🔍 移動開始チェック:", {
        currentTool,
        isDraggingElement,
        selectedElementIds: selectedElementIds.length,
        imageCoords
      })
      
      if (currentTool !== "select" || isDraggingElement || selectedElementIds.length === 0) {
        console.log("❌ 移動開始条件に合わない")
        return false
      }

      // 選択された要素の当たり判定をチェック
      for (const selectedId of selectedElementIds) {
        const selectedElement = drawingElements.find(el => el.id === selectedId)
        if (selectedElement && hitTestElement(selectedElement, imageCoords.x, imageCoords.y)) {
          // 選択された要素内でマウスが移動した場合、移動開始
          console.log("🚀 移動開始:", {
            elementId: selectedId,
            imageCoords,
            elementPos: { x: selectedElement.x, y: selectedElement.y },
          })
          
          setIsDraggingElement(true)
          const dragOffsetX = imageCoords.x - selectedElement.x
          const dragOffsetY = imageCoords.y - selectedElement.y
          setDragElementOffset({
            x: dragOffsetX,
            y: dragOffsetY,
          })
          return true
        }
      }
      console.log("❌ 選択要素に当たらない")
      return false
    },
    [
      currentTool,
      isDraggingElement,
      selectedElementIds,
      drawingElements,
      hitTestElement,
      setIsDraggingElement,
      setDragElementOffset,
    ],
  )

  // 要素移動処理
  const handleElementMovement = useCallback(
    (imageCoords: { x: number; y: number }) => {
      if (currentTool !== "select" || !isDraggingElement || selectedElementIds.length === 0) {
        return false
      }

      console.log("🚀 ドラッグ移動中:", {
        selectedElementIds,
        imageCoords,
        dragElementOffset,
      })

      const firstElementId = selectedElementIds[0]
      const firstElement = drawingElements.find(el => el.id === firstElementId)

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
            const deltaX = imageCoords.x - dragElementOffset.x - firstElement.x
            const deltaY = imageCoords.y - dragElementOffset.y - firstElement.y
            
            // 全選択要素を同じ量だけ移動
            selectedElementIds.forEach((elementId) => {
              const element = drawingElements.find(el => el.id === elementId)
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
    },
    [
      currentTool,
      isDraggingElement,
      selectedElementIds,
      drawingElements,
      lineEditMode,
      dragElementOffset,
      updateDrawingElement,
    ],
  )

  // 要素移動終了処理
  const handleMovementEnd = useCallback(() => {
    console.log("🔄 handleMovementEnd呼び出し:", {
      currentTool,
      isDraggingElement,
      selectedElementIds: selectedElementIds.length
    })
    
    if (currentTool !== "select") {
      console.log("❌ 選択ツールではない - movement end処理をスキップ")
      return false
    }

    let handled = false
    if (isDraggingElement) {
      console.log("🏁 要素ドラッグ終了 - 状態リセット:", {
        selectedElementIds,
        isDraggingElement,
        dragElementOffset
      })
      setIsDraggingElement(false)
      setDragElementOffset({ x: 0, y: 0 }) // オフセットもリセット
      setLineEditMode(null)
      setRectangleEditMode(null)
      handled = true
      console.log("✅ 要素ドラッグ状態リセット完了")
    } else {
      console.log("ℹ️ ドラッグしていなかった - movement end処理をスキップ")
    }
    return handled
  }, [
    currentTool,
    isDraggingElement,
    selectedElementIds,
    dragElementOffset,
    setIsDraggingElement,
    setDragElementOffset,
    setLineEditMode,
    setRectangleEditMode,
  ])

  return {
    checkMovementStart,
    handleElementMovement,
    handleMovementEnd,
  }
}