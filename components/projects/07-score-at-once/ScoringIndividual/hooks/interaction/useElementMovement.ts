import type {
  DrawingElement,
  LineEditMode,
  RectangleEditMode,
} from "@/components/projects/07-score-at-once/ScoringIndividual/types/answer-individual-types"
import { useCallback, useRef } from "react"

interface UseElementMovementProps {
  currentTool: string
  drawingElements: DrawingElement[]
  selectedElementIds: string[]
  isDraggingElement: boolean
  lineEditMode: LineEditMode
  isShiftPressed: boolean

  // Actions
  setIsDraggingElement: (dragging: boolean) => void
  setDragElementOffset: (offset: { x: number; y: number }) => void
  setLineEditMode: (mode: LineEditMode) => void
  setRectangleEditMode: (mode: RectangleEditMode) => void
  updateDrawingElement: (id: string, updates: Partial<DrawingElement>) => void
  // リサイズ操作用の追加
  setIsResizingElement?: (resizing: boolean) => void
  setResizeHandle?: (handle: string | null) => void

  // Utils
  hitTestElement: (element: DrawingElement, x: number, y: number) => boolean
  hitTestHandle?: (
    element: DrawingElement,
    x: number,
    y: number
  ) => string | null
}

export function useElementMovement({
  currentTool,
  drawingElements,
  selectedElementIds,
  isDraggingElement,
  lineEditMode,
  isShiftPressed,
  setIsDraggingElement,
  setDragElementOffset,
  setLineEditMode,
  setRectangleEditMode,
  updateDrawingElement,
  setIsResizingElement = () => {},
  setResizeHandle = () => {},
}: UseElementMovementProps) {
  // パフォーマンス最適化: デバウンス用のタイマー
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingUpdatesRef = useRef<Map<string, Partial<DrawingElement>>>(
    new Map()
  )

  // 即時更新関数（デバウンスなし）
  const debouncedUpdate = useCallback(
    (elementId: string, updates: Partial<DrawingElement>) => {
      // 即座に更新を実行
      updateDrawingElement(elementId, updates)
    },
    [updateDrawingElement]
  )

  // リサイズ状態
  const resizeStartRef = useRef<{
    element: DrawingElement
    handle: string
    startX: number
    startY: number
    originalX: number
    originalY: number
    originalWidth: number
    originalHeight: number
  } | null>(null)

  // 移動開始時の状態を保存（絶対座標計算用）
  const moveStartRef = useRef<{
    startMouseX: number
    startMouseY: number
    elements: Map<
      string,
      {
        x: number
        y: number
        endX?: number
        endY?: number
        displayX?: number
        displayY?: number
        type?: string
      }
    >
  } | null>(null)

  // リサイズ処理
  const handleElementResize = useCallback(
    (imageCoords: { x: number; y: number }) => {
      if (!resizeStartRef.current) return false

      const {
        element,
        handle,
        originalX,
        originalY,
        originalWidth,
        originalHeight,
        startX,
        startY,
      } = resizeStartRef.current
      const deltaX = imageCoords.x - startX
      const deltaY = imageCoords.y - startY

      let newX = originalX
      let newY = originalY
      let newWidth = originalWidth
      let newHeight = originalHeight

      // ハンドルに応じてサイズと位置を計算
      switch (handle) {
        case "top-left":
          newX = originalX + deltaX
          newY = originalY + deltaY
          newWidth = originalWidth - deltaX
          newHeight = originalHeight - deltaY
          break
        case "top-right":
          newY = originalY + deltaY
          newWidth = originalWidth + deltaX
          newHeight = originalHeight - deltaY
          break
        case "bottom-left":
          newX = originalX + deltaX
          newWidth = originalWidth - deltaX
          newHeight = originalHeight + deltaY
          break
        case "bottom-right":
          newWidth = originalWidth + deltaX
          newHeight = originalHeight + deltaY
          break
      }

      // 最小サイズ制限を削除（任意のサイズを許容）

      // Shiftキーで縦横比を維持
      if (
        isShiftPressed &&
        (element.type === "rectangle" || element.type === "ellipse")
      ) {
        if (element.type === "ellipse") {
          // 円・楕円の場合は正円を維持
          const size = Math.max(Math.abs(newWidth), Math.abs(newHeight))
          newWidth = newWidth < 0 ? -size : size
          newHeight = newHeight < 0 ? -size : size
        } else if (originalWidth !== 0 && originalHeight !== 0) {
          // 矩形の場合は縦横比を維持
          const aspectRatio = originalWidth / originalHeight
          if (Math.abs(newWidth / newHeight) > Math.abs(aspectRatio)) {
            newHeight = newWidth / aspectRatio
          } else {
            newWidth = newHeight * aspectRatio
          }
        }
      }

      const updates: Partial<DrawingElement> = { x: newX, y: newY }
      if (element.type === "rectangle" || element.type === "ellipse") {
        updates.width = newWidth
        updates.height = newHeight
      } else if (element.type === "text") {
        updates.textBoxWidth = newWidth
        updates.textBoxHeight = newHeight
      }

      debouncedUpdate(element.id, updates)
      return true
    },
    [isShiftPressed, debouncedUpdate]
  )

  // 要素移動処理
  const handleElementMovement = useCallback(
    (imageCoords: { x: number; y: number }) => {
      // リサイズ中の場合
      if (resizeStartRef.current) {
        return handleElementResize(imageCoords)
      }

      if (
        currentTool !== "select" ||
        !isDraggingElement ||
        selectedElementIds.length === 0
      ) {
        return false
      }

      // 移動開始状態がない場合は何もしない
      if (!moveStartRef.current) {
        return false
      }

      const firstElementId = selectedElementIds[0]
      const originalFirstElement =
        moveStartRef.current.elements.get(firstElementId)

      // 線の編集モード（start/end/move）の場合
      if (lineEditMode && originalFirstElement) {
        // 線の編集（最初の要素のみ）- 開始時の座標を使用
        if (lineEditMode === "start") {
          let newX = imageCoords.x
          let newY = imageCoords.y

          // Shiftキーが押されている場合は縦横制限（開始時の終了点座標を使用）
          if (
            isShiftPressed &&
            originalFirstElement.endX !== undefined &&
            originalFirstElement.endY !== undefined
          ) {
            const deltaX = Math.abs(newX - originalFirstElement.endX)
            const deltaY = Math.abs(newY - originalFirstElement.endY)

            // 水平・垂直のどちらに近いかを判定
            if (deltaX > deltaY) {
              // 水平線（Y座標を固定）
              newY = originalFirstElement.endY
            } else {
              // 垂直線（X座標を固定）
              newX = originalFirstElement.endX
            }
          }

          debouncedUpdate(firstElementId, {
            x: newX,
            y: newY,
          })
        } else if (lineEditMode === "end") {
          let newEndX = imageCoords.x
          let newEndY = imageCoords.y

          // Shiftキーが押されている場合は縦横制限（開始時の開始点座標を使用）
          if (isShiftPressed) {
            const deltaX = Math.abs(newEndX - originalFirstElement.x)
            const deltaY = Math.abs(newEndY - originalFirstElement.y)

            // 水平・垂直のどちらに近いかを判定
            if (deltaX > deltaY) {
              // 水平線（Y座標を固定）
              newEndY = originalFirstElement.y
            } else {
              // 垂直線（X座標を固定）
              newEndX = originalFirstElement.x
            }
          }

          debouncedUpdate(firstElementId, {
            endX: newEndX,
            endY: newEndY,
          })
        } else if (lineEditMode === "move") {
          // 移動開始時の座標から絶対座標で計算
          const deltaX = imageCoords.x - moveStartRef.current.startMouseX
          const deltaY = imageCoords.y - moveStartRef.current.startMouseY

          // 全選択要素を移動開始時の座標 + delta で更新
          selectedElementIds.forEach((elementId) => {
            const originalCoords = moveStartRef.current?.elements.get(elementId)
            if (originalCoords) {
              const updates: Partial<DrawingElement> = {
                x: originalCoords.x + deltaX,
                y: originalCoords.y + deltaY,
              }

              // 線の場合はendX/endYも更新
              if (
                originalCoords.endX !== undefined &&
                originalCoords.endY !== undefined
              ) {
                updates.endX = originalCoords.endX + deltaX
                updates.endY = originalCoords.endY + deltaY
              }

              // テキストの場合はdisplayX/displayYも更新
              if (originalCoords.type === "text") {
                if (originalCoords.displayX !== undefined) {
                  updates.displayX = originalCoords.displayX + deltaX
                }
                if (originalCoords.displayY !== undefined) {
                  updates.displayY = originalCoords.displayY + deltaY
                }
              }

              debouncedUpdate(elementId, updates)
            }
          })
        }
      } else {
        // 通常の移動（全選択要素を移動）- 絶対座標ベース
        const deltaX = imageCoords.x - moveStartRef.current.startMouseX
        const deltaY = imageCoords.y - moveStartRef.current.startMouseY

        selectedElementIds.forEach((elementId) => {
          const originalCoords = moveStartRef.current?.elements.get(elementId)
          if (originalCoords) {
            const updates: Partial<DrawingElement> = {
              x: originalCoords.x + deltaX,
              y: originalCoords.y + deltaY,
            }

            // 線の場合はendX/endYも更新
            if (
              originalCoords.endX !== undefined &&
              originalCoords.endY !== undefined
            ) {
              updates.endX = originalCoords.endX + deltaX
              updates.endY = originalCoords.endY + deltaY
            }

            // テキストの場合はdisplayX/displayYも更新
            if (originalCoords.type === "text") {
              if (originalCoords.displayX !== undefined) {
                updates.displayX = originalCoords.displayX + deltaX
              }
              if (originalCoords.displayY !== undefined) {
                updates.displayY = originalCoords.displayY + deltaY
              }
            }

            debouncedUpdate(elementId, updates)
          }
        })
      }
      return true
    },
    [
      currentTool,
      isDraggingElement,
      selectedElementIds,
      lineEditMode,
      isShiftPressed,
      debouncedUpdate,
      handleElementResize,
    ]
  )

  // 要素移動終了処理
  const handleMovementEnd = useCallback(() => {
    if (currentTool !== "select") {
      return false
    }

    let handled = false

    // 保留中の更新を即座に実行
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current)
      pendingUpdatesRef.current.forEach((pendingUpdates, id) => {
        updateDrawingElement(id, pendingUpdates)
      })
      pendingUpdatesRef.current.clear()
      updateTimerRef.current = null
    }

    if (isDraggingElement) {
      setIsDraggingElement(false)
      setDragElementOffset({ x: 0, y: 0 }) // オフセットもリセット
      setLineEditMode(null)
      setRectangleEditMode(null)
      moveStartRef.current = null // 移動開始状態をクリア
      handled = true
    }

    // リサイズ終了
    if (resizeStartRef.current) {
      setIsResizingElement(false)
      setResizeHandle(null)
      resizeStartRef.current = null
      handled = true
    }

    return handled
  }, [
    currentTool,
    isDraggingElement,
    setIsDraggingElement,
    setDragElementOffset,
    setLineEditMode,
    setRectangleEditMode,
    setIsResizingElement,
    setResizeHandle,
    updateDrawingElement,
  ])

  // 外部から移動開始状態を初期化する関数
  const initializeMoveStart = useCallback(
    (imageCoords: { x: number; y: number }, elementIds: string[]) => {
      const elementsMap = new Map<
        string,
        {
          x: number
          y: number
          endX?: number
          endY?: number
          displayX?: number
          displayY?: number
          type?: string
        }
      >()
      for (const elemId of elementIds) {
        const elem = drawingElements.find((el) => el.id === elemId)
        if (elem) {
          elementsMap.set(elemId, {
            x: elem.x,
            y: elem.y,
            endX: elem.endX,
            endY: elem.endY,
            displayX: elem.displayX,
            displayY: elem.displayY,
            type: elem.type,
          })
        }
      }
      moveStartRef.current = {
        startMouseX: imageCoords.x,
        startMouseY: imageCoords.y,
        elements: elementsMap,
      }
    },
    [drawingElements]
  )

  return {
    handleElementMovement,
    handleMovementEnd,
    initializeMoveStart,
  }
}
