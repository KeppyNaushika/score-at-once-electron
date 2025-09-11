import type {
  DrawingElement,
  LineStyle,
} from "@/components/projects/07-score-at-once/ScoringIndividual/types/answer-individual-types"
import { useCallback } from "react"

interface UseDrawingHandlersProps {
  currentTool: string
  isDrawing: boolean
  currentDrawing: Partial<DrawingElement> | null
  isShiftPressed: boolean
  strokeColor: string
  strokeWidth: number
  lineStyle: LineStyle

  // Actions
  setIsDrawing: (drawing: boolean) => void
  setCurrentDrawing: (drawing: Partial<DrawingElement> | null) => void
  addDrawingElement: (element: DrawingElement) => void

  // V4 Text anchor integration
  onTextAnchorClick?: (position: { x: number; y: number }) => void
}

export function useDrawingHandlers({
  currentTool,
  isDrawing,
  currentDrawing,
  isShiftPressed,
  strokeColor,
  strokeWidth,
  lineStyle,
  setIsDrawing,
  setCurrentDrawing,
  addDrawingElement,
  onTextAnchorClick,
}: UseDrawingHandlersProps) {
  // 描画ツールのマウスダウン処理
  const handleDrawingMouseDown = useCallback(
    (imageCoords: { x: number; y: number }) => {
      // 描画ツールの処理
      if (currentTool === "text") {
        // V4統合: テキストアンカー機能
        if (onTextAnchorClick) {
          onTextAnchorClick(imageCoords)
        }
        return true
      } else if (currentTool === "line") {
        setIsDrawing(true)
        setCurrentDrawing({
          id: Math.random().toString(36).substring(2, 11),
          type: "line",
          x: imageCoords.x,
          y: imageCoords.y,
          endX: imageCoords.x,
          endY: imageCoords.y,
          color: strokeColor,
          strokeWidth,
          lineStyle,
        })
        return true
      } else if (currentTool === "rectangle") {
        setIsDrawing(true)
        setCurrentDrawing({
          id: Math.random().toString(36).substring(2, 11),
          type: "rectangle",
          x: imageCoords.x,
          y: imageCoords.y,
          width: 0,
          height: 0,
          color: strokeColor,
          strokeWidth,
        })
        return true
      } else if (currentTool === "ellipse") {
        setIsDrawing(true)
        setCurrentDrawing({
          id: Math.random().toString(36).substring(2, 11),
          type: "ellipse",
          x: imageCoords.x,
          y: imageCoords.y,
          width: 0,
          height: 0,
          color: strokeColor,
          strokeWidth,
        })
        return true
      }

      return false
    },
    [
      currentTool,
      strokeColor,
      strokeWidth,
      lineStyle,
      setIsDrawing,
      setCurrentDrawing,
      onTextAnchorClick,
    ],
  )

  // 描画ツールのマウス移動処理
  const handleDrawingMouseMove = useCallback(
    (imageCoords: { x: number; y: number }) => {
      if (
        !isDrawing ||
        !currentDrawing ||
        currentDrawing.x === undefined ||
        currentDrawing.y === undefined
      )
        return false

      if (currentDrawing.type === "line") {
        // 線の描画
        let endX = imageCoords.x
        let endY = imageCoords.y

        // Shift+ドラッグで縦横制限（水平・垂直のみ）
        if (isShiftPressed) {
          const deltaX = Math.abs(endX - currentDrawing.x)
          const deltaY = Math.abs(endY - currentDrawing.y)

          // 水平・垂直のどちらに近いかを判定
          if (deltaX > deltaY) {
            // 水平線（Y座標を固定）
            endY = currentDrawing.y
          } else {
            // 垂直線（X座標を固定）
            endX = currentDrawing.x
          }
        }

        setCurrentDrawing({
          ...currentDrawing,
          endX,
          endY,
        })
        return true
      } else if (currentDrawing.type === "rectangle") {
        // 矩形の描画
        let width = imageCoords.x - currentDrawing.x
        let height = imageCoords.y - currentDrawing.y

        // Shiftキーが押されている場合は正方形に制限
        if (isShiftPressed) {
          const minSize = Math.min(Math.abs(width), Math.abs(height))
          width = width >= 0 ? minSize : -minSize
          height = height >= 0 ? minSize : -minSize
        }

        setCurrentDrawing({
          ...currentDrawing,
          width,
          height,
        })
        return true
      } else if (currentDrawing.type === "ellipse") {
        // 楕円の描画
        let width = imageCoords.x - currentDrawing.x
        let height = imageCoords.y - currentDrawing.y

        // Shiftキーが押されている場合は正円に制限
        if (isShiftPressed) {
          const minSize = Math.min(Math.abs(width), Math.abs(height))
          width = width >= 0 ? minSize : -minSize
          height = width // 高さを幅と同じにする
        }

        setCurrentDrawing({
          ...currentDrawing,
          width,
          height,
        })
        return true
      }

      return false
    },
    [
      isDrawing,
      currentDrawing,
      isShiftPressed,
      setCurrentDrawing,
    ],
  )

  // 描画ツールのマウスアップ処理
  const handleDrawingMouseUp = useCallback(() => {
    if (!isDrawing || !currentDrawing) return false

    // V4統合: テキストアンカー機能では、マウスアップ処理は不要
    // テキストはクリック時に即座にアンカー設置とモーダル表示を行う
    
    if (currentDrawing.type === "line") {
      // 線の描画完了処理
      if (currentDrawing.id) {
        addDrawingElement(currentDrawing as DrawingElement)
      }
      setIsDrawing(false)
      setCurrentDrawing(null)
      return true
    } else {
      // その他の描画要素の完了
      if (currentDrawing.id) {
        addDrawingElement(currentDrawing as DrawingElement)
      }
      setIsDrawing(false)
      setCurrentDrawing(null)
      return true
    }
  }, [
    isDrawing,
    currentDrawing,
    setIsDrawing,
    setCurrentDrawing,
    addDrawingElement,
  ])

  return {
    handleDrawingMouseDown,
    handleDrawingMouseMove,
    handleDrawingMouseUp,
  }
}
