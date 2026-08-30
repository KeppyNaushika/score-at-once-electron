import { useCallback, useRef } from "react"

import type {
  LineEditMode,
  RectangleEditMode,
} from "@/components/exams/07-score-at-once/ScoringIndividual/types"
import type { DrawingAnnotation } from "@/types/drawingAnnotation.types"

interface UseElementMovementProps {
  currentTool: string
  drawingElements: DrawingAnnotation[]
  selectedElementIds: string[]
  isDraggingElement: boolean
  lineEditMode: LineEditMode
  isShiftPressed: boolean

  // Actions
  setIsDraggingElement: (dragging: boolean) => void
  setDragElementOffset: (offset: { x: number; y: number }) => void
  setLineEditMode: (mode: LineEditMode) => void
  setRectangleEditMode: (mode: RectangleEditMode) => void
  /** 掴んでいる間の見た目を動かす（DBへは書かない） */
  setDrawingElements: (
    elements:
      DrawingAnnotation[] | ((prev: DrawingAnnotation[]) => DrawingAnnotation[])
  ) => void
  /** 離したときに1回だけ書く */
  updateDrawingElements: (
    updates: Array<{ id: string; updates: Partial<DrawingAnnotation> }>
  ) => void
  // リサイズ操作用の追加
  setIsResizingElement?: (resizing: boolean) => void
  setResizeHandle?: (handle: string | null) => void

  // Utils
  hitTestElement: (element: DrawingAnnotation, x: number, y: number) => boolean
  hitTestHandle?: (
    element: DrawingAnnotation,
    x: number,
    y: number
  ) => string | null
}

/**
 * 描画要素の移動・リサイズ操作を管理するフック。
 *
 * **掴んでいる間は書かない。** 動かしている途中の姿はローカル状態に持ち、離した
 * ときに1回だけ DB へ書く（`handleMovementEnd`）。採点領域の編集（02-template の
 * `usePointerHandlers`）・つまみ（`useAsbWriteGate`）・同じ画面のリサイズと同じ形で、
 * かつては `pointermove` のたびに書いていたため、1回の移動で数十回 DB と監査ログを
 * 叩いていた。
 */
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
  setDrawingElements,
  updateDrawingElements,
  setIsResizingElement = () => {},
  setResizeHandle = () => {},
}: UseElementMovementProps) {
  // 掴んでいる間に動かした結果。要素ごとに最後の姿だけを持ち、離したときに書く
  const pendingUpdatesRef = useRef<Map<string, Partial<DrawingAnnotation>>>(
    new Map()
  )

  /**
   * 掴んでいる間に動かした分を書く。ここが操作の終わり。
   *
   * `handleMovementEnd` と、ツールが掴んでいる間に変わってしまった経路
   * （`handleSelectionMouseUp` の早期 return）の両方から呼ぶ。**溜めたまま次の操作へ
   * 持ち越さない。**
   */
  const flushPendingMoves = useCallback(() => {
    const pending = pendingUpdatesRef.current
    if (pending.size === 0) return

    updateDrawingElements(
      Array.from(pending, ([id, updates]) => ({ id, updates }))
    )
    pending.clear()
  }, [updateDrawingElements])

  /** 見た目だけを動かし、書き込みは離すまで溜める */
  const applyMove = useCallback(
    (elementId: string, updates: Partial<DrawingAnnotation>) => {
      const pending = pendingUpdatesRef.current
      pending.set(elementId, { ...pending.get(elementId), ...updates })

      setDrawingElements((prev) =>
        prev.map((element) =>
          element.id === elementId ? { ...element, ...updates } : element
        )
      )
    },
    [setDrawingElements]
  )

  // リサイズ状態
  const resizeStartRef = useRef<{
    element: DrawingAnnotation
    handle: string
    startX: number
    startY: number
    originalX: number
    originalY: number
    originalWidth: number
    originalHeight: number
  } | null>(null)

  // 移動開始時の状態を保存（絶対座標計算用）。
  // 行をそのまま控える（座標だけ抜き出すと、どの列を動かすかの判断が抜き出した形に依存する）
  const moveStartRef = useRef<{
    startMouseX: number
    startMouseY: number
    elements: Map<string, DrawingAnnotation>
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

      const updates: Partial<DrawingAnnotation> = { x: newX, y: newY }
      if (element.type === "rectangle" || element.type === "ellipse") {
        updates.width = newWidth
        updates.height = newHeight
      } else if (element.type === "text") {
        updates.textBoxWidth = newWidth
        updates.textBoxHeight = newHeight
      }

      applyMove(element.id, updates)
      return true
    },
    [isShiftPressed, applyMove]
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
          if (isShiftPressed) {
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

          applyMove(firstElementId, {
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

          applyMove(firstElementId, {
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
              const updates: Partial<DrawingAnnotation> = {
                x: originalCoords.x + deltaX,
                y: originalCoords.y + deltaY,
              }

              // 線の場合はendX/endYも更新
              if (originalCoords.type === "line") {
                updates.endX = originalCoords.endX + deltaX
                updates.endY = originalCoords.endY + deltaY
              }

              // テキストの場合はdisplayX/displayYも更新
              if (originalCoords.type === "text") {
                updates.displayX = originalCoords.displayX + deltaX
                updates.displayY = originalCoords.displayY + deltaY
              }

              applyMove(elementId, updates)
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
            const updates: Partial<DrawingAnnotation> = {
              x: originalCoords.x + deltaX,
              y: originalCoords.y + deltaY,
            }

            // 線の場合はendX/endYも更新
            if (originalCoords.type === "line") {
              updates.endX = originalCoords.endX + deltaX
              updates.endY = originalCoords.endY + deltaY
            }

            // テキストの場合はdisplayX/displayYも更新
            if (originalCoords.type === "text") {
              updates.displayX = originalCoords.displayX + deltaX
              updates.displayY = originalCoords.displayY + deltaY
            }

            applyMove(elementId, updates)
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
      applyMove,
      handleElementResize,
    ]
  )

  // 要素移動終了処理
  const handleMovementEnd = useCallback(() => {
    if (currentTool !== "select") {
      return false
    }

    let handled = false

    // 掴んでいる間に動かした分をまとめて1回で書く。
    // **書いたことを `handled` にはしない。** ここが真になると、矩形選択の終わり
    // （`completeRectangleSelection`）が呼ばれずに飛ばされる
    flushPendingMoves()

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
    flushPendingMoves,
  ])

  // 外部から移動開始状態を初期化する関数
  const initializeMoveStart = useCallback(
    (imageCoords: { x: number; y: number }, elementIds: string[]) => {
      const elementsMap = new Map<string, DrawingAnnotation>()
      for (const elementId of elementIds) {
        const element = drawingElements.find(
          (candidateElement) => candidateElement.id === elementId
        )
        if (element) {
          elementsMap.set(elementId, element)
        }
      }
      moveStartRef.current = {
        startMouseX: imageCoords.x,
        startMouseY: imageCoords.y,
        elements: elementsMap,
      }
      // 前の操作の書き残しを次の操作へ持ち越さない
      pendingUpdatesRef.current.clear()
    },
    [drawingElements]
  )

  return {
    handleElementMovement,
    handleMovementEnd,
    initializeMoveStart,
    flushPendingMoves,
  }
}
