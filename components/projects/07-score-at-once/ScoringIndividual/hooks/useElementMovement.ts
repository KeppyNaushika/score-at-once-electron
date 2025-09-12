import type { DrawingElement } from "@/components/projects/07-score-at-once/ScoringIndividual/types/answer-individual-types"
import { useCallback, useRef } from "react"

interface UseElementMovementProps {
  currentTool: string
  drawingElements: DrawingElement[]
  selectedElementIds: string[]
  isDraggingElement: boolean
  lineEditMode: any
  dragElementOffset: { x: number; y: number }
  isShiftPressed: boolean

  // Actions
  setIsDraggingElement: (dragging: boolean) => void
  setDragElementOffset: (offset: { x: number; y: number }) => void
  setLineEditMode: (mode: any) => void
  setRectangleEditMode: (mode: any) => void
  updateDrawingElement: (id: string, updates: any) => void
  // リサイズ操作用の追加
  setIsResizingElement?: (resizing: boolean) => void
  setResizeHandle?: (handle: string | null) => void
  
  // Utils
  hitTestElement: (element: any, x: number, y: number) => boolean
  hitTestHandle?: (element: any, x: number, y: number) => string | null
}

export function useElementMovement({
  currentTool,
  drawingElements,
  selectedElementIds,
  isDraggingElement,
  lineEditMode,
  dragElementOffset,
  isShiftPressed,
  setIsDraggingElement,
  setDragElementOffset,
  setLineEditMode,
  setRectangleEditMode,
  updateDrawingElement,
  setIsResizingElement = () => {},
  setResizeHandle = () => {},
  hitTestElement,
  hitTestHandle = () => null,
}: UseElementMovementProps) {
  // パフォーマンス最適化: デバウンス用のタイマー
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingUpdatesRef = useRef<Map<string, any>>(new Map())
  
  // デバウンスされた更新関数
  const debouncedUpdate = useCallback(
    (elementId: string, updates: any) => {
      // 保留中の更新をマージ
      const existing = pendingUpdatesRef.current.get(elementId) || {}
      pendingUpdatesRef.current.set(elementId, { ...existing, ...updates })
      
      // 既存のタイマーをクリア
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current)
      }
      
      // 新しいタイマーを設定（16ms = 60fps相当）
      updateTimerRef.current = setTimeout(() => {
        // 全ての保留中の更新を一度に実行
        pendingUpdatesRef.current.forEach((pendingUpdates, id) => {
          updateDrawingElement(id, pendingUpdates)
        })
        pendingUpdatesRef.current.clear()
        updateTimerRef.current = null
      }, 16)
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

  // 要素移動の開始チェック（マウスダウン時のみ実行される想定）
  const checkMovementStart = useCallback(
    (imageCoords: { x: number; y: number }) => {
      if (
        currentTool !== "select" ||
        isDraggingElement ||
        selectedElementIds.length === 0
      ) {
        return false
      }

      // まずハンドル（リサイズ）をチェック
      for (const selectedId of selectedElementIds) {
        const selectedElement = drawingElements.find(
          (el) => el.id === selectedId,
        )
        if (selectedElement) {
          const handle = hitTestHandle(selectedElement, imageCoords.x, imageCoords.y)
          if (handle) {
            // リサイズ開始
            setIsResizingElement(true)
            setResizeHandle(handle)
            resizeStartRef.current = {
              element: selectedElement,
              handle,
              startX: imageCoords.x,
              startY: imageCoords.y,
              originalX: selectedElement.x,
              originalY: selectedElement.y,
              originalWidth: selectedElement.width || selectedElement.textBoxWidth || 0,
              originalHeight: selectedElement.height || selectedElement.textBoxHeight || 0,
            }
            return true
          }
        }
      }

      // 次に移動をチェック
      for (const selectedId of selectedElementIds) {
        const selectedElement = drawingElements.find(
          (el) => el.id === selectedId,
        )
        if (
          selectedElement &&
          hitTestElement(selectedElement, imageCoords.x, imageCoords.y)
        ) {
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
      return false
    },
    [
      currentTool,
      isDraggingElement,
      selectedElementIds,
      drawingElements,
      hitTestElement,
      hitTestHandle,
      setIsDraggingElement,
      setDragElementOffset,
      setIsResizingElement,
      setResizeHandle,
    ],
  )

  // リサイズ処理
  const handleElementResize = useCallback(
    (imageCoords: { x: number; y: number }) => {
      if (!resizeStartRef.current) return false
      
      const { element, handle, originalX, originalY, originalWidth, originalHeight, startX, startY } = resizeStartRef.current
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
      
      // 最小サイズ制限
      const minSize = 0.02
      if (Math.abs(newWidth) < minSize) newWidth = newWidth < 0 ? -minSize : minSize
      if (Math.abs(newHeight) < minSize) newHeight = newHeight < 0 ? -minSize : minSize
      
      // Shiftキーで縦横比を維持
      if (isShiftPressed && (element.type === "rectangle" || element.type === "ellipse")) {
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
      
      const updates: any = { x: newX, y: newY }
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

      const firstElementId = selectedElementIds[0]
      const firstElement = drawingElements.find(
        (el) => el.id === firstElementId,
      )

      if (firstElement) {
        if (firstElement.type === "line" && lineEditMode) {
          // 線の編集（最初の要素のみ）
          if (lineEditMode === "start") {
            let newX = imageCoords.x
            let newY = imageCoords.y

            // Shiftキーが押されている場合は縦横制限
            if (
              isShiftPressed &&
              firstElement.endX !== undefined &&
              firstElement.endY !== undefined
            ) {
              const deltaX = Math.abs(newX - firstElement.endX)
              const deltaY = Math.abs(newY - firstElement.endY)

              // 水平・垂直のどちらに近いかを判定
              if (deltaX > deltaY) {
                // 水平線（Y座標を固定）
                newY = firstElement.endY
              } else {
                // 垂直線（X座標を固定）
                newX = firstElement.endX
              }
            }

            debouncedUpdate(firstElementId, {
              x: newX,
              y: newY,
            })
          } else if (lineEditMode === "end") {
            let newEndX = imageCoords.x
            let newEndY = imageCoords.y

            // Shiftキーが押されている場合は縦横制限
            if (isShiftPressed) {
              const deltaX = Math.abs(newEndX - firstElement.x)
              const deltaY = Math.abs(newEndY - firstElement.y)

              // 水平・垂直のどちらに近いかを判定
              if (deltaX > deltaY) {
                // 水平線（Y座標を固定）
                newEndY = firstElement.y
              } else {
                // 垂直線（X座標を固定）
                newEndX = firstElement.x
              }
            }

            debouncedUpdate(firstElementId, {
              endX: newEndX,
              endY: newEndY,
            })
          } else if (lineEditMode === "move") {
            const deltaX = imageCoords.x - dragElementOffset.x - firstElement.x
            const deltaY = imageCoords.y - dragElementOffset.y - firstElement.y

            // 全選択要素を同じ量だけ移動
            selectedElementIds.forEach((elementId) => {
              const element = drawingElements.find((el) => el.id === elementId)
              if (element) {
                if (
                  element.type === "line" &&
                  element.endX !== undefined &&
                  element.endY !== undefined
                ) {
                  debouncedUpdate(elementId, {
                    x: element.x + deltaX,
                    y: element.y + deltaY,
                    endX: element.endX + deltaX,
                    endY: element.endY + deltaY,
                  })
                } else {
                  debouncedUpdate(elementId, {
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
                debouncedUpdate(elementId, {
                  x: element.x + deltaX,
                  y: element.y + deltaY,
                  endX: element.endX + deltaX,
                  endY: element.endY + deltaY,
                })
              } else {
                debouncedUpdate(elementId, {
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
      isShiftPressed,
      debouncedUpdate,
      handleElementResize,
    ],
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

  return {
    checkMovementStart,
    handleElementMovement,
    handleElementResize,
    handleMovementEnd,
  }
}