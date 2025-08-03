import type { DrawingElement } from "@/components/projects/07-score-at-once/ScoringIndividual/types/answer-individual-types"
import { useCallback } from "react"

interface UseDrawingHandlersProps {
  currentTool: string
  isDrawing: boolean
  currentDrawing: Partial<DrawingElement> | null
  isCreatingTextBox: boolean
  isShiftPressed: boolean
  strokeColor: string
  strokeWidth: number
  lineStyle: any

  // Actions
  setIsCreatingTextBox: (creating: boolean) => void
  setIsDrawing: (drawing: boolean) => void
  setCurrentDrawing: (drawing: Partial<DrawingElement> | null) => void
  addDrawingElement: (element: DrawingElement) => void

  // For text input
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  imageRef: React.RefObject<HTMLImageElement | null>
  zoom: number
  setTextInputPosition: (position: { x: number; y: number }) => void
  setShowTextInput: (show: boolean) => void
  setTextInputValue: (value: string) => void
}

export function useDrawingHandlers({
  currentTool,
  isDrawing,
  currentDrawing,
  isCreatingTextBox,
  isShiftPressed,
  strokeColor,
  strokeWidth,
  lineStyle,
  setIsCreatingTextBox,
  setIsDrawing,
  setCurrentDrawing,
  addDrawingElement,
  canvasRef,
  containerRef,
  imageRef,
  zoom,
  setTextInputPosition,
  setShowTextInput,
  setTextInputValue,
}: UseDrawingHandlersProps) {
  // 描画ツールのマウスダウン処理
  const handleDrawingMouseDown = useCallback(
    (imageCoords: { x: number; y: number }) => {
      // 描画ツールの処理
      if (currentTool === "text") {
        setIsCreatingTextBox(true)
        setIsDrawing(true)
        setCurrentDrawing({
          id: Math.random().toString(36).substring(2, 11),
          type: "text",
          x: imageCoords.x,
          y: imageCoords.y,
          textBoxWidth: 0,
          textBoxHeight: 0,
          color: strokeColor,
          strokeWidth,
          fontSize: 16,
        })
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
      } else if (currentTool === "rectangle-horizontal") {
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
      }

      return false
    },
    [
      currentTool,
      strokeColor,
      strokeWidth,
      lineStyle,
      setIsCreatingTextBox,
      setIsDrawing,
      setCurrentDrawing,
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

      if (currentDrawing.type === "text" && isCreatingTextBox) {
        // テキストボックスのサイズ調整
        const width = Math.abs(imageCoords.x - currentDrawing.x)
        const height = Math.abs(imageCoords.y - currentDrawing.y)
        setCurrentDrawing({
          ...currentDrawing,
          textBoxWidth: width,
          textBoxHeight: height,
        })
        return true
      } else if (currentDrawing.type === "line") {
        // 線の描画
        let endX = imageCoords.x
        let endY = imageCoords.y

        // Shift+ドラッグで垂直・水平線の判定
        if (isShiftPressed) {
          const deltaX = Math.abs(endX - currentDrawing.x)
          const deltaY = Math.abs(endY - currentDrawing.y)

          if (deltaX > deltaY) {
            // 水平線
            endY = currentDrawing.y
          } else {
            // 垂直線
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
        
        // rectangle-horizontalの場合は横長に制限
        if (currentTool === "rectangle-horizontal") {
          const maxHeight = Math.abs(width) * 0.3 // 高さを幅の30%に制限
          if (Math.abs(height) > maxHeight) {
            height = height > 0 ? maxHeight : -maxHeight
          }
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
      isCreatingTextBox,
      isShiftPressed,
      setCurrentDrawing,
    ],
  )

  // 描画ツールのマウスアップ処理
  const handleDrawingMouseUp = useCallback(() => {
    if (!isDrawing || !currentDrawing) return false

    if (currentDrawing.type === "text" && isCreatingTextBox) {
      // テキストボックス作成完了
      setIsCreatingTextBox(false)
      setIsDrawing(false)

      // テキスト入力モーダルを表示（CSS scale + scroll 方式）
      if (
        canvasRef.current &&
        containerRef.current &&
        currentDrawing.x !== undefined &&
        currentDrawing.y !== undefined
      ) {
        const img = imageRef.current
        const container = containerRef.current
        if (img) {
          // 画像上の座標をスクリーン座標に変換（NaN防止）
          const imageX = (currentDrawing.x || 0) * (img.naturalWidth || 800)
          const imageY = (currentDrawing.y || 0) * (img.naturalHeight || 600)

          const safeZoom = zoom || 1
          const scrollX = container.scrollLeft || 0
          const scrollY = container.scrollTop || 0

          // Canvas中央配置オフセットを考慮
          const canvasElement = canvasRef.current
          const canvasWidth = canvasElement
            ? canvasElement.width
            : img.naturalWidth || 800
          const imageOffsetX = (canvasWidth - (img.naturalWidth || 800)) / 2

          // 実際のスクリーン座標計算
          const actualX = imageX + imageOffsetX
          const actualY = imageY

          // CSS scale + scroll を考慮したスクリーン座標
          const screenX = actualX * safeZoom - scrollX
          const screenY = actualY * safeZoom - scrollY

          // NaNチェック
          const validX = isNaN(screenX) ? 100 : screenX
          const validY = isNaN(screenY) ? 100 : screenY

          setTextInputPosition({ x: validX, y: validY })
          setShowTextInput(true)
          setTextInputValue("")
        }
      }
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
    isCreatingTextBox,
    setIsCreatingTextBox,
    setIsDrawing,
    canvasRef,
    containerRef,
    imageRef,
    zoom,
    setTextInputPosition,
    setShowTextInput,
    setTextInputValue,
    setCurrentDrawing,
    addDrawingElement,
  ])

  return {
    handleDrawingMouseDown,
    handleDrawingMouseMove,
    handleDrawingMouseUp,
  }
}
