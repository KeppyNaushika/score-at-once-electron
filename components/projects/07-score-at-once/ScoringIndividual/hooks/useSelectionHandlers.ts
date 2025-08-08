import { useCursorUtils } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useCursorUtils"
import { useElementMovement } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useElementMovement"
import { useElementSelection } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useElementSelection"
import { useRectangleSelection } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useRectangleSelection"
import { useResizeCursorUtils } from "@/components/projects/07-score-at-once/ScoringIndividual/hooks/useResizeCursorUtils"
import type {
  DrawingElement,
  SelectionRectangle,
} from "@/components/projects/07-score-at-once/ScoringIndividual/types/answer-individual-types"
import { renderMarkdownToCanvas } from "@/components/projects/07-score-at-once/ScoringIndividual/utils/canvasTextRendererHybrid"
import { useCallback, useEffect, useState } from "react"

interface UseSelectionHandlersProps {
  currentTool: string
  drawingElements: DrawingElement[]
  selectedElementIds: string[]
  isDraggingElement: boolean
  isDrawingSelection: boolean
  selectionRectangle: SelectionRectangle | null
  isCtrlPressed: boolean
  isShiftPressed: boolean
  lineEditMode: any
  dragElementOffset: { x: number; y: number }

  // Canvas ref for cursor management
  canvasRef: React.RefObject<HTMLCanvasElement | null>

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
  hitTestHandle: (element: any, x: number, y: number) => string | null
  getLineEditMode: (element: any, x: number, y: number) => any
  getRectangleEditMode: (element: any, x: number, y: number) => any

  // テキスト再編集
  onTextElementReClick?: (element: any) => void
}

export function useSelectionHandlers({
  currentTool,
  drawingElements,
  selectedElementIds,
  isDraggingElement,
  isDrawingSelection,
  selectionRectangle,
  isCtrlPressed,
  isShiftPressed,
  lineEditMode,
  dragElementOffset,
  canvasRef,
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
  hitTestHandle,
  getLineEditMode,
  getRectangleEditMode,
  onTextElementReClick,
}: UseSelectionHandlersProps) {
  // リサイズ状態管理
  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<string | null>(null) // ハンドル名で管理
  const [resizeElementId, setResizeElementId] = useState<string | null>(null)
  const [resizeStartCoords, setResizeStartCoords] = useState<{
    x: number
    y: number
  } | null>(null)
  const [resizeOriginalBounds, setResizeOriginalBounds] = useState<{
    x: number
    y: number
    width: number
    height: number
  } | null>(null)

  // ポインターキャプチャ管理用の状態
  const [capturedPointerId, setCapturedPointerId] = useState<number | null>(
    null,
  )
  const [isGlobalCaptureActive, setIsGlobalCaptureActive] = useState(false)

  // リサイズ境界オーバーフロー追跡用の状態
  const [resizeOverflow, setResizeOverflow] = useState<{
    x: number;
    y: number;
  } | null>(null)

  // Initialize cursor utilities
  const { setCursor, resetCursor } = useCursorUtils({
    canvasRef,
  })

  // Initialize resize cursor utilities
  const { checkResizeHandle } = useResizeCursorUtils({
    hitTestHandle,
  })

  // Initialize specialized handlers
  const { handleElementSelection } = useElementSelection({
    currentTool,
    drawingElements,
    selectedElementIds,
    isCtrlPressed,
    toggleSelection,
    setSelectedElementIds,
    clearSelection,
    setLineEditMode,
    setRectangleEditMode,
    hitTestElement,
    getLineEditMode,
    getRectangleEditMode,
    onTextElementReClick,
  })

  const { checkMovementStart, handleElementMovement, handleMovementEnd } =
    useElementMovement({
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
      hitTestElement,
    })

  const {
    startRectangleSelection,
    updateRectangleSelection,
    completeRectangleSelection,
  } = useRectangleSelection({
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
  })

  // LaTeX記法をMarkdown記法に変換
  const convertLatexToMarkdown = useCallback((text: string): string => {
    return text
      .replace(/\\\(/g, "$") // \( を $ に
      .replace(/\\\)/g, "$") // \) を $ に
      .replace(/\\\[/g, "$$") // \[ を $$ に
      .replace(/\\\]/g, "$$") // \] を $$ に
  }, [])

  // テキストボックスのアスペクト比維持リサイズ処理
  const handleTextBoxAspectRatioResize = useCallback(
    async (
      element: DrawingElement,
      deltaX: number,
      deltaY: number,
      resizeDirection: string,
      originalBounds: { x: number; y: number; width: number; height: number },
    ) => {
      if (!element.text) return

      // 正規化座標でのサイズ制限
      const minWidth = 0.03 // 最小幅 (3%)
      const minHeight = 0.02 // 最小高 (2%)
      const maxWidth = 0.8 // 最大幅制限 (80%)
      const maxHeight = 0.8 // 最大高制限 (80%)

      // 基本的なリサイズ計算（座標系を正しく処理）
      let targetWidth = originalBounds.width
      let targetHeight = originalBounds.height
      let targetX = originalBounds.x
      let targetY = originalBounds.y

      // 各方向のリサイズで固定点と可変点を正しく計算
      switch (resizeDirection) {
        case "nw-resize": // 左上ドラッグ
          {
            // 固定点: 右下角
            const fixedX = originalBounds.x + originalBounds.width
            const fixedY = originalBounds.y + originalBounds.height

            // 可変点: 新しい左上角（マウス位置）
            const variableX = originalBounds.x + deltaX
            const variableY = originalBounds.y + deltaY

            // 新しいサイズ = 固定点 - 可変点
            const newWidth = Math.max(
              minWidth,
              Math.min(maxWidth, fixedX - variableX),
            )
            const newHeight = Math.max(
              minHeight,
              Math.min(maxHeight, fixedY - variableY),
            )

            // サイズ制限後の座標計算（固定点基準）
            targetWidth = newWidth
            targetHeight = newHeight
            targetX = fixedX - newWidth
            targetY = fixedY - newHeight
          }
          break

        case "ne-resize": // 右上ドラッグ
          {
            // 固定点: 左下角
            const fixedX = originalBounds.x
            const fixedY = originalBounds.y + originalBounds.height

            // 可変点: 新しい右上角
            const variableX = originalBounds.x + originalBounds.width + deltaX
            const variableY = originalBounds.y + deltaY

            // 新しいサイズ計算
            const newWidth = Math.max(
              minWidth,
              Math.min(maxWidth, variableX - fixedX),
            )
            const newHeight = Math.max(
              minHeight,
              Math.min(maxHeight, fixedY - variableY),
            )

            targetWidth = newWidth
            targetHeight = newHeight
            targetX = fixedX
            targetY = fixedY - newHeight
          }
          break

        case "sw-resize": // 左下ドラッグ
          {
            // 固定点: 右上角
            const fixedX = originalBounds.x + originalBounds.width
            const fixedY = originalBounds.y

            // 可変点: 新しい左下角
            const variableX = originalBounds.x + deltaX
            const variableY = originalBounds.y + originalBounds.height + deltaY

            // 新しいサイズ計算
            const newWidth = Math.max(
              minWidth,
              Math.min(maxWidth, fixedX - variableX),
            )
            const newHeight = Math.max(
              minHeight,
              Math.min(maxHeight, variableY - fixedY),
            )

            targetWidth = newWidth
            targetHeight = newHeight
            targetX = fixedX - newWidth
            targetY = fixedY
          }
          break

        case "se-resize": // 右下ドラッグ
        case "nwse-resize": // フォールバック
          {
            // 固定点: 左上角
            const fixedX = originalBounds.x
            const fixedY = originalBounds.y

            // 可変点: 新しい右下角
            const variableX = originalBounds.x + originalBounds.width + deltaX
            const variableY = originalBounds.y + originalBounds.height + deltaY

            // 新しいサイズ計算
            const newWidth = Math.max(
              minWidth,
              Math.min(maxWidth, variableX - fixedX),
            )
            const newHeight = Math.max(
              minHeight,
              Math.min(maxHeight, variableY - fixedY),
            )

            targetWidth = newWidth
            targetHeight = newHeight
            targetX = fixedX
            targetY = fixedY
          }
          break

        case "nesw-resize": // 対角フォールバック
          {
            // nw-resizeと同じ処理
            const fixedX = originalBounds.x + originalBounds.width
            const fixedY = originalBounds.y + originalBounds.height
            const variableX = originalBounds.x + deltaX
            const variableY = originalBounds.y + deltaY
            const newWidth = Math.max(
              minWidth,
              Math.min(maxWidth, fixedX - variableX),
            )
            const newHeight = Math.max(
              minHeight,
              Math.min(maxHeight, fixedY - variableY),
            )

            targetWidth = newWidth
            targetHeight = newHeight
            targetX = fixedX - newWidth
            targetY = fixedY - newHeight
          }
          break
      }

      // 正規化座標の境界チェック (0.0 - 1.0)
      targetX = Math.max(0.0, Math.min(1.0, targetX))
      targetY = Math.max(0.0, Math.min(1.0, targetY))

      try {
        // 実際のコンテンツサイズを測定
        const processedText = convertLatexToMarkdown(element.text)
        const result = await renderMarkdownToCanvas({
          text: processedText,
          color: element.color,
          fontSize: element.fontSize || 16,
          maxWidth: targetWidth,
          maxHeight: targetHeight,
          backgroundColor: "transparent",
        })

        // renderMarkdownToCanvasが既にアスペクト比維持処理を行っているため、
        // その結果をそのまま使用（追加のスケーリング処理は不要）
        const finalWidth = Math.max(
          Math.min(result.dimensions.width, targetWidth),
          minWidth,
        )
        const finalHeight = Math.max(
          Math.min(result.dimensions.height, targetHeight),
          minHeight,
        )

        // 中央配置用の座標調整（コンテンツが小さい場合）
        let finalX = targetX
        let finalY = targetY

        // コンテンツがターゲットサイズより小さい場合、テキストボックスサイズを調整
        if (
          result.dimensions.width < targetWidth ||
          result.dimensions.height < targetHeight
        ) {
          // リサイズ方向に応じて座標を再調整
          if (resizeDirection.includes("w")) {
            // 左側リサイズの場合
            finalX = targetX + (targetWidth - finalWidth)
          }
          if (resizeDirection.includes("n")) {
            // 上側リサイズの場合
            finalY = targetY + (targetHeight - finalHeight)
          }
        }

        // 正規化座標の最終境界チェック (0.0 - 1.0)
        finalX = Math.max(0.0, Math.min(1.0, finalX))
        finalY = Math.max(0.0, Math.min(1.0, finalY))

        // 要素を更新
        const updates = {
          x: finalX,
          y: finalY,
          textBoxWidth: finalWidth,
          textBoxHeight: finalHeight,
        }

        updateDrawingElement(element.id, updates)
      } catch (error) {
        console.error("テキストボックスリサイズエラー:", error)
        // エラー時はシンプルなフォールバック処理
        const fallbackUpdates = {
          x: Math.max(0, targetX),
          y: Math.max(0, targetY),
          textBoxWidth: Math.max(minWidth, targetWidth),
          textBoxHeight: Math.max(minHeight, targetHeight),
        }
        updateDrawingElement(element.id, fallbackUpdates)
      }
    },
    [convertLatexToMarkdown, updateDrawingElement],
  )

  // 座標正規化関数（負のサイズを正の値に変換）
  const normalizeElementCoordinates = useCallback(
    (element: DrawingElement) => {
      const isTextBox =
        element.type === "text" &&
        element.textBoxWidth !== undefined &&
        element.textBoxHeight !== undefined

      let needsUpdate = false
      const updates: any = {}

      if (isTextBox) {
        // テキストボックスの場合
        let currentX = element.x
        let currentY = element.y
        let currentWidth = element.textBoxWidth!
        let currentHeight = element.textBoxHeight!

        // 幅が負の場合の正規化
        if (currentWidth < 0) {
          updates.x = currentX + currentWidth // 左端を右端にシフト
          updates.textBoxWidth = Math.abs(currentWidth) // 絶対値に
          needsUpdate = true

          console.log("🔄 Normalized negative width:", {
            oldX: currentX,
            newX: updates.x,
            oldWidth: currentWidth,
            newWidth: updates.textBoxWidth,
          })
        }

        // 高さが負の場合の正規化
        if (currentHeight < 0) {
          updates.y = currentY + currentHeight // 上端を下端にシフト
          updates.textBoxHeight = Math.abs(currentHeight) // 絶対値に
          needsUpdate = true

          console.log("🔄 Normalized negative height:", {
            oldY: currentY,
            newY: updates.y,
            oldHeight: currentHeight,
            newHeight: updates.textBoxHeight,
          })
        }
      } else {
        // 通常要素の場合
        let currentX = element.x
        let currentY = element.y
        let currentWidth = element.width || 0
        let currentHeight = element.height || 0

        // 幅が負の場合の正規化
        if (currentWidth < 0) {
          updates.x = currentX + currentWidth
          updates.width = Math.abs(currentWidth)
          needsUpdate = true

          console.log("🔄 Normalized negative width (standard):", {
            oldX: currentX,
            newX: updates.x,
            oldWidth: currentWidth,
            newWidth: updates.width,
          })
        }

        // 高さが負の場合の正規化
        if (currentHeight < 0) {
          updates.y = currentY + currentHeight
          updates.height = Math.abs(currentHeight)
          needsUpdate = true

          console.log("🔄 Normalized negative height (standard):", {
            oldY: currentY,
            newY: updates.y,
            oldHeight: currentHeight,
            newHeight: updates.height,
          })
        }
      }

      // 更新が必要な場合のみ実行
      if (needsUpdate) {
        console.log("🔄 Coordinate normalization applied:", {
          elementId: element.id,
          elementType: element.type,
          updates,
        })

        updateDrawingElement(element.id, updates)
      } else {
        console.log(
          "✅ No coordinate normalization needed for element:",
          element.id,
        )
      }
    },
    [updateDrawingElement],
  )

  // 正規化座標系での境界制限関数
  const applyNormalizedBounds = useCallback(
    (
      x: number,
      y: number,
      width: number,
      height: number,
    ): { x: number; y: number; width: number; height: number } => {
      console.log("🔍 Before normalization:", { x, y, width, height })

      // Step 1: サイズを正の値に変換（負の場合は座標も調整）
      let normalizedX = x
      let normalizedY = y
      let normalizedWidth = width
      let normalizedHeight = height

      if (width < 0) {
        normalizedX = x + width // 左端を調整
        normalizedWidth = Math.abs(width)
      }

      if (height < 0) {
        normalizedY = y + height // 上端を調整
        normalizedHeight = Math.abs(height)
      }

      // Step 2: 座標を0-1範囲にクランプ
      normalizedX = Math.max(0, Math.min(1, normalizedX))
      normalizedY = Math.max(0, Math.min(1, normalizedY))

      // Step 3: サイズを0.01-1範囲にクランプ（最小1%）
      normalizedWidth = Math.max(0.01, Math.min(1, normalizedWidth))
      normalizedHeight = Math.max(0.01, Math.min(1, normalizedHeight))

      // Step 4: 座標+サイズが1を超えないように調整
      if (normalizedX + normalizedWidth > 1) {
        normalizedWidth = 1 - normalizedX // 幅を調整
      }

      if (normalizedY + normalizedHeight > 1) {
        normalizedHeight = 1 - normalizedY // 高さを調整
      }

      // Step 5: 最小サイズ確保のための最終調整
      if (normalizedWidth < 0.01) {
        normalizedWidth = 0.01
        normalizedX = Math.min(normalizedX, 0.99) // 左端を調整
      }

      if (normalizedHeight < 0.01) {
        normalizedHeight = 0.01
        normalizedY = Math.min(normalizedY, 0.99) // 上端を調整
      }

      console.log("🔍 After normalization:", {
        x: normalizedX,
        y: normalizedY,
        width: normalizedWidth,
        height: normalizedHeight,
        totalX: normalizedX + normalizedWidth,
        totalY: normalizedY + normalizedHeight,
      })

      return {
        x: normalizedX,
        y: normalizedY,
        width: normalizedWidth,
        height: normalizedHeight,
      }
    },
    [],
  )

  // 画面座標を正規化座標に変換する関数（範囲外も許可）
  const convertScreenToNormalizedCoords = useCallback(
    (screenX: number, screenY: number, allowOutOfBounds: boolean = false): { x: number; y: number } => {
      const canvas = canvasRef.current
      if (!canvas) return { x: 0, y: 0 }

      // Canvasの境界を取得
      const rect = canvas.getBoundingClientRect()

      // Canvas内での相対座標を計算
      const relativeX = screenX - rect.left
      const relativeY = screenY - rect.top

      // 正規化座標に変換
      let normalizedX = relativeX / rect.width
      let normalizedY = relativeY / rect.height

      // 範囲外を許可しない場合のみクランプ
      if (!allowOutOfBounds) {
        normalizedX = Math.max(0, Math.min(1, normalizedX))
        normalizedY = Math.max(0, Math.min(1, normalizedY))
      }

      console.log("🔍 Screen to Normalized Coords:", {
        screenCoords: { x: screenX, y: screenY },
        canvasRect: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
        relativeCoords: { x: relativeX, y: relativeY },
        normalizedCoords: { x: normalizedX, y: normalizedY },
        allowOutOfBounds,
        wasOutOfBounds: normalizedX < 0 || normalizedX > 1 || normalizedY < 0 || normalizedY > 1,
      })

      return { x: normalizedX, y: normalizedY }
    },
    [canvasRef],
  )

  // ハイブリッドキャプチャ管理（setPointerCapture + document.addEventListener）
  const startHybridCapture = useCallback(
    (pointerId?: number) => {
      console.log("🎯 Starting hybrid capture (setPointerCapture + document)", { pointerId })
      
      // 方式1: setPointerCapture（可能な場合）
      if (pointerId !== undefined) {
        const canvas = canvasRef.current
        if (canvas) {
          try {
            canvas.setPointerCapture(pointerId)
            setCapturedPointerId(pointerId)
            console.log("✅ setPointerCapture successful")
          } catch (error) {
            console.log("⚠️ setPointerCapture failed, using document fallback only")
          }
        }
      }

      // 方式2: document.addEventListener（フォールバック + 追加保険）
      setIsGlobalCaptureActive(true)
      
      // 選択を防止
      document.body.style.userSelect = "none"
    },
    [canvasRef],
  )

  // ハイブリッドキャプチャ終了
  const stopHybridCapture = useCallback(() => {
    console.log("🎯 Stopping hybrid capture")
    setCapturedPointerId(null)
    setIsGlobalCaptureActive(false)

    // 選択を復元
    document.body.style.userSelect = ""
  }, [])

  // Convenience functions for backwards compatibility
  const startPointerCapture = useCallback((pointerId?: number) => {
    startHybridCapture(pointerId)
  }, [startHybridCapture])

  const stopPointerCapture = useCallback(() => {
    stopHybridCapture()
  }, [stopHybridCapture])

  // 通常要素のリサイズ処理
  const handleStandardElementResize = useCallback(
    (
      element: DrawingElement,
      deltaX: number,
      deltaY: number,
      resizeDirection: string,
      originalBounds: { x: number; y: number; width: number; height: number },
      elementId: string,
    ) => {
      const minSize = 0.02 // 正規化座標での最小サイズ (2%)
      const maxSize = 0.8 // 正規化座標での最大サイズ (80%)

      let newWidth = originalBounds.width
      let newHeight = originalBounds.height
      let newX = originalBounds.x
      let newY = originalBounds.y

      // ハンドル名で正しいリサイズ処理を実行
      switch (resizeDirection) {
        case "top-left": // 左上ハンドルドラッグ
          {
            console.log("🔍 TOP-LEFT Resize Processing (Out-of-bounds):", {
              originalBounds,
              deltaX,
              deltaY,
              isNormalizedCoords: originalBounds.x < 2 && originalBounds.y < 2,
              boundsRange: `x:${originalBounds.x.toFixed(3)}-${(originalBounds.x + originalBounds.width).toFixed(3)}, y:${originalBounds.y.toFixed(3)}-${(originalBounds.y + originalBounds.height).toFixed(3)}`,
            })

            // 範囲外でも継続計算: 新しい左上座標 = 元の座標 + マウス移動量
            const desiredX = originalBounds.x + deltaX
            const desiredY = originalBounds.y + deltaY

            // 右下角は固定
            const fixedRightX = originalBounds.x + originalBounds.width
            const fixedBottomY = originalBounds.y + originalBounds.height

            // 新しいサイズ = 固定された右下 - 新しい左上（範囲外も許可）
            const desiredWidth = fixedRightX - desiredX
            const desiredHeight = fixedBottomY - desiredY

            console.log("🔍 TOP-LEFT Calculations (Out-of-bounds allowed):", {
              desiredPosition: { x: desiredX, y: desiredY },
              fixedPoint: { x: fixedRightX, y: fixedBottomY },
              desiredSize: { width: desiredWidth, height: desiredHeight },
              allowsOutOfBounds: true,
            })

            // 範囲外も許可してサイズ計算継続
            newWidth = desiredWidth
            newHeight = desiredHeight

            // 実際の座標（右下基準で逆算、範囲外も許可）
            newX = fixedRightX - newWidth
            newY = fixedBottomY - newHeight

            console.log("🔍 TOP-LEFT Final Result (Pre-normalization):", {
              finalPosition: { x: newX, y: newY },
              finalSize: { width: newWidth, height: newHeight },
              isOutOfBounds: newX < 0 || newX > 1 || newY < 0 || newY > 1 || newWidth < 0 || newHeight < 0,
              willBeNormalizedLater: true,
            })
          }
          break

        case "top-right": // 右上ハンドルドラッグ
          {
            const desiredX = originalBounds.x + originalBounds.width + deltaX
            const desiredY = originalBounds.y + deltaY

            const fixedX = originalBounds.x
            const fixedY = originalBounds.y + originalBounds.height

            // 範囲外も許可して計算継続
            const desiredWidth = desiredX - fixedX
            const desiredHeight = fixedY - desiredY

            newWidth = desiredWidth
            newHeight = desiredHeight

            newX = fixedX
            newY = fixedY - newHeight
          }
          break

        case "bottom-left": // 左下ハンドルドラッグ
          {
            const desiredX = originalBounds.x + deltaX
            const desiredY = originalBounds.y + originalBounds.height + deltaY

            const fixedX = originalBounds.x + originalBounds.width
            const fixedY = originalBounds.y

            // 範囲外も許可して計算継続
            const desiredWidth = fixedX - desiredX
            const desiredHeight = desiredY - fixedY

            newWidth = desiredWidth
            newHeight = desiredHeight

            newX = fixedX - newWidth
            newY = fixedY
          }
          break

        case "bottom-right": // 右下ハンドルドラッグ
          {
            const desiredX = originalBounds.x + originalBounds.width + deltaX
            const desiredY = originalBounds.y + originalBounds.height + deltaY

            const fixedX = originalBounds.x
            const fixedY = originalBounds.y

            // 範囲外も許可して計算継続
            const desiredWidth = desiredX - fixedX
            const desiredHeight = desiredY - fixedY

            newWidth = desiredWidth
            newHeight = desiredHeight

            newX = fixedX
            newY = fixedY
          }
          break
      }

      // ⭐ 境界チェック前の生の値を保存（オーバーフロー検出用）
      const rawBounds = { x: newX, y: newY, width: newWidth, height: newHeight }
      
      // 境界オーバーフローの計算
      const overflow = {
        x: Math.min(0, newX) + Math.max(0, (newX + newWidth) - 1),
        y: Math.min(0, newY) + Math.max(0, (newY + newHeight) - 1),
      }
      
      // オーバーフローが発生している場合は記録（状態変化時のみ更新）
      const hasOverflow = overflow.x !== 0 || overflow.y !== 0
      if (hasOverflow) {
        // 前回と異なる場合のみ更新（不必要なre-renderを防ぐ）
        setResizeOverflow(prev => {
          if (!prev || prev.x !== overflow.x || prev.y !== overflow.y) {
            console.log("🚨 Boundary overflow detected, but resize continues:", {
              overflow,
              rawBounds,
              isResizingStillActive: isResizing, // これが true のまま維持される
              resizeDirection,
            })
            return overflow
          }
          return prev
        })
      } else {
        // オーバーフローなし - 前回がnullでなければnullに設定
        setResizeOverflow(prev => prev !== null ? null : prev)
      }

      // 正規化座標系での境界制限を適用
      const normalized = applyNormalizedBounds(newX, newY, newWidth, newHeight)
      const finalX = normalized.x
      const finalY = normalized.y
      const finalWidth = normalized.width
      const finalHeight = normalized.height

      // ⭐ 境界に達してもリサイズ継続フラグは維持
      const isBoundaryReached = (
        normalized.x !== newX ||
        normalized.y !== newY ||
        normalized.width !== newWidth ||
        normalized.height !== newHeight
      )

      if (isBoundaryReached) {
        console.log("🔍 Boundary reached but resize continues:", {
          rawBounds,
          normalized: { x: finalX, y: finalY, width: finalWidth, height: finalHeight },
          overflow,
          resizeStillActive: isResizing, // これが true のまま維持される
          resizeDirection,
        })
      } else {
        console.log("🔍 Normal resize (within bounds):", {
          rawBounds,
          normalized: { x: finalX, y: finalY, width: finalWidth, height: finalHeight },
          resizeDirection,
        })
      }

      // 要素を更新
      const updates: any = {
        x: finalX,
        y: finalY,
      }

      if (element.type === "text") {
        updates.textBoxWidth = finalWidth
        updates.textBoxHeight = finalHeight
      } else {
        updates.width = finalWidth
        updates.height = finalHeight
      }
      updateDrawingElement(elementId, updates)
    },
    [applyNormalizedBounds, updateDrawingElement, isResizing],
  )

  // Main mouse down handler（pointer events対応）
  const handleSelectionMouseDown = useCallback(
    (
      imageCoords: { x: number; y: number },
      originalEvent?: PointerEvent | MouseEvent,
    ) => {
      if (currentTool !== "select") return false

      // 選択された要素がある場合、まずリサイズハンドルをチェック
      if (selectedElementIds.length > 0) {
        const selectedElement = drawingElements.find((el) =>
          selectedElementIds.includes(el.id),
        )

        if (selectedElement) {
          // まずハンドル名を取得
          const handleName = hitTestHandle(
            selectedElement,
            imageCoords.x,
            imageCoords.y,
          )

          if (handleName) {
            // ハンドル名からカーソルを取得（表示用）
            const resizeCursor = checkResizeHandle(
              selectedElement,
              imageCoords.x,
              imageCoords.y,
            )

            console.log("🔍 Resize Start:", {
              handleName,
              resizeCursor,
              coordinates: imageCoords,
            })

            // リサイズモード開始（ハンドル名で管理）
            setIsResizing(true)
            setResizeHandle(handleName) // ハンドル名を保存
            setResizeElementId(selectedElement.id)
            setResizeStartCoords(imageCoords)

            // 元のサイズと位置を保存
            const bounds = {
              x: selectedElement.x,
              y: selectedElement.y,
              width: selectedElement.textBoxWidth || selectedElement.width || 0,
              height:
                selectedElement.textBoxHeight || selectedElement.height || 0,
            }
            setResizeOriginalBounds(bounds)

            // ハイブリッドキャプチャを開始（画面外ドラッグを可能にする）
            if (originalEvent && "pointerId" in originalEvent) {
              // PointerEvent の場合：ハイブリッド方式
              startHybridCapture(originalEvent.pointerId)
            } else {
              // MouseEvent の場合：document.addEventListener のみ
              console.log("🔄 MouseEvent detected, using document capture only")
              startHybridCapture() // pointerId なし
            }

            setCursor(resizeCursor as any)
            return true
          }
        }
      }

      // Try element selection first
      const { elementSelected, clickedElement, clickedCoords } =
        handleElementSelection(imageCoords)

      // If no element was selected, start rectangle selection
      if (!elementSelected) {
        // 長方形選択開始時にクロスヘアカーソルを設定
        setCursor("crosshair")
        startRectangleSelection(imageCoords)
      } else {
        // 要素が選択された場合、即座に移動開始のセットアップを行う
        if (clickedElement && clickedCoords) {
          // 移動開始状態をセット
          setIsDraggingElement(true)
          const dragOffsetX = clickedCoords.x - clickedElement.x
          const dragOffsetY = clickedCoords.y - clickedElement.y
          setDragElementOffset({
            x: dragOffsetX,
            y: dragOffsetY,
          })
        }
      }

      return true
    },
    [
      currentTool,
      selectedElementIds,
      handleElementSelection,
      drawingElements,
      hitTestHandle,
      checkResizeHandle,
      startHybridCapture,
      setCursor,
      startRectangleSelection,
      setIsDraggingElement,
      setDragElementOffset,
    ],
  )

  // Check if mouse is over any element (for cursor styling)
  const checkElementHover = useCallback(
    (imageCoords: { x: number; y: number }) => {
      if (currentTool !== "select")
        return { hasElement: false, resizeCursor: null }

      // Check if any element is under the cursor
      for (let i = drawingElements.length - 1; i >= 0; i--) {
        const element = drawingElements[i]

        // まずリサイズハンドルをチェック（優先度高）
        const resizeCursor = checkResizeHandle(
          element,
          imageCoords.x,
          imageCoords.y,
        )
        if (resizeCursor) {
          return { hasElement: true, resizeCursor: resizeCursor }
        }

        // 次に要素本体をチェック
        if (hitTestElement(element, imageCoords.x, imageCoords.y)) {
          return { hasElement: true, resizeCursor: null }
        }
      }
      return { hasElement: false, resizeCursor: null }
    },
    [currentTool, drawingElements, checkResizeHandle, hitTestElement],
  )

  // Main mouse move handler
  const handleSelectionMouseMove = useCallback(
    (imageCoords: { x: number; y: number }) => {
      if (currentTool !== "select") {
        resetCursor()
        return false
      }

      // リサイズ中の処理
      if (
        isResizing &&
        resizeElementId &&
        resizeStartCoords &&
        resizeOriginalBounds &&
        resizeHandle
      ) {
        const deltaX = imageCoords.x - resizeStartCoords.x
        const deltaY = imageCoords.y - resizeStartCoords.y

        const element = drawingElements.find((el) => el.id === resizeElementId)

        if (!element) return false

        // ⭐ 画面外の座標も含めてデルタを計算（継続処理を確認）
        console.log("🔍 Resize continues (even at boundary):", {
          resizeHandle,
          deltaX,
          deltaY,
          normalizedCoords: imageCoords,
          isOutOfBounds: imageCoords.x < 0 || imageCoords.x > 1 || imageCoords.y < 0 || imageCoords.y > 1,
          originalBounds: resizeOriginalBounds,
          elementType: element.type,
          isResizingFlag: isResizing, // isResizing状態を監視
        })

        // ハンドル名を使用してリサイズ処理
        handleStandardElementResize(
          element,
          deltaX,
          deltaY,
          resizeHandle, // ハンドル名を渡す
          resizeOriginalBounds,
          resizeElementId,
        )

        return true
      }

      // Update cursor based on current state
      if (isDrawingSelection) {
        // 長方形選択描画中はクロスヘアカーソル
        setCursor("crosshair")
      } else if (isDraggingElement) {
        // 要素ドラッグ中は移動カーソル
        setCursor("move")
      } else {
        // 要素ホバー判定
        const hoverResult = checkElementHover(imageCoords)

        if (hoverResult.hasElement) {
          if (hoverResult.resizeCursor) {
            // リサイズハンドルの上にある場合はリサイズカーソル
            setCursor(hoverResult.resizeCursor as any)
          } else {
            // 要素の上にある場合は移動カーソル（選択可能）
            setCursor("move")
          }
        } else {
          // 要素がない場所はクロスヘアカーソル（長方形選択可能）
          setCursor("crosshair")
        }
      }

      // Handle element movement (only when already dragging)
      if (handleElementMovement(imageCoords)) return true

      // Handle rectangle selection update
      if (updateRectangleSelection(imageCoords)) return true

      return false
    },
    [
      currentTool,
      isResizing,
      resizeElementId,
      resizeStartCoords,
      resizeOriginalBounds,
      resizeHandle,
      isDrawingSelection,
      isDraggingElement,
      handleElementMovement,
      updateRectangleSelection,
      resetCursor,
      drawingElements,
      handleStandardElementResize,
      setCursor,
      checkElementHover,
    ],
  )

  // Main mouse up handler
  const handleSelectionMouseUp = useCallback(() => {
    if (currentTool !== "select") return false

    let handled = false

    // リサイズ終了処理
    if (isResizing) {
      console.log("🏁 Ending resize operation (Mouse Up):", {
        resizeElementId,
        reason: "Mouse up detected - normal completion"
      })

      // リサイズ完了時に座標正規化を実行
      if (resizeElementId) {
        const elementToNormalize = drawingElements.find(
          (el) => el.id === resizeElementId,
        )

        if (elementToNormalize) {
          normalizeElementCoordinates(elementToNormalize)
        }
      }

      setIsResizing(false)
      setResizeHandle(null) // ハンドル名をリセット
      setResizeElementId(null)
      setResizeStartCoords(null)
      setResizeOriginalBounds(null)
      setResizeOverflow(null) // オーバーフロー状態もリセット

      // ポインターキャプチャを終了
      stopPointerCapture()

      resetCursor()
      return true
    }

    // 長方形選択状態を事前に保存（completeRectangleSelectionがfalseに変更する前に）
    const wasDrawingSelection = isDrawingSelection

    // Handle movement end
    if (handleMovementEnd()) handled = true

    // Handle rectangle selection completion
    if (completeRectangleSelection()) handled = true

    // ドラッグ終了時はカーソルをリセット（成功・失敗に関係なく）
    if (wasDrawingSelection) {
      resetCursor()
    }

    return handled
  }, [
    currentTool,
    isResizing,
    isDrawingSelection,
    handleMovementEnd,
    completeRectangleSelection,
    resizeElementId,
    stopPointerCapture,
    resetCursor,
    drawingElements,
    normalizeElementCoordinates,
  ])

  // ポインターイベントハンドラーをCanvasに追加
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handlePointerMove = (event: PointerEvent) => {
      if (!isResizing || capturedPointerId !== event.pointerId) return

      // 画面座標を正規化座標に変換（範囲外も許可してリサイズ継続）
      const normalizedCoords = convertScreenToNormalizedCoords(
        event.clientX,
        event.clientY,
        true  // 範囲外も許可
      )

      console.log("🔍 Pointer Move (Out-of-bounds allowed):", {
        screenCoords: { x: event.clientX, y: event.clientY },
        normalizedCoords,
        isResizing,
        pointerId: event.pointerId,
        capturedPointerId,
        isOutOfBounds: normalizedCoords.x < 0 || normalizedCoords.x > 1 || normalizedCoords.y < 0 || normalizedCoords.y > 1,
      })

      // 既存のマウス移動処理を呼び出し
      handleSelectionMouseMove(normalizedCoords)
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (!isResizing || capturedPointerId !== event.pointerId) return

      console.log("🔍 Pointer Up:", {
        screenCoords: { x: event.clientX, y: event.clientY },
        isResizing,
        pointerId: event.pointerId,
        capturedPointerId,
      })

      // 既存のマウスアップ処理を呼び出し
      handleSelectionMouseUp()
    }

    // Canvas にポインターイベントリスナーを追加
    canvas.addEventListener("pointermove", handlePointerMove)
    canvas.addEventListener("pointerup", handlePointerUp)

    return () => {
      // クリーンアップ
      canvas.removeEventListener("pointermove", handlePointerMove)
      canvas.removeEventListener("pointerup", handlePointerUp)
    }
  }, [
    isResizing,
    capturedPointerId,
    convertScreenToNormalizedCoords,
    handleSelectionMouseMove,
    handleSelectionMouseUp,
    canvasRef,
  ])

  // Document-level event listeners for global capture (when setPointerCapture fails)
  useEffect(() => {
    if (!isGlobalCaptureActive || !isResizing) return

    console.log("🌍 Activating document-level capture for out-of-bounds dragging")

    const handleDocumentPointerMove = (event: PointerEvent) => {
      // ⭐ 境界外でも座標を記録（制限なし）
      const normalizedCoords = convertScreenToNormalizedCoords(
        event.clientX,
        event.clientY,
        true // Allow out-of-bounds - これが重要
      )

      // デバッグ：実際の座標と状態を表示
      console.log("🌍 Unrestricted coords (Document-level capture):", {
        screen: { x: event.clientX, y: event.clientY },
        normalized: normalizedCoords,
        isResizingActive: isResizing, // これが false になっていないか確認
        isGlobalCaptureActive,
        isOutOfBounds: normalizedCoords.x < 0 || normalizedCoords.x > 1 || normalizedCoords.y < 0 || normalizedCoords.y > 1,
      })

      // リサイズ処理を継続（境界に達してもfalseにならないよう確認）
      const resizeProcessed = handleSelectionMouseMove(normalizedCoords)
      
      if (!resizeProcessed) {
        console.warn("🚨 Document-level resize processing failed - check if isResizing became false")
      }
      
      // Prevent default behavior
      event.preventDefault()
      event.stopPropagation()
    }

    const handleDocumentPointerUp = (event: PointerEvent) => {
      console.log("🌍 Document Pointer Up (Global Capture):", {
        screenCoords: { x: event.clientX, y: event.clientY },
        isResizing,
        isGlobalCaptureActive,
      })

      // End resize operation
      handleSelectionMouseUp()
      
      // Prevent default behavior
      event.preventDefault()
      event.stopPropagation()
    }

    // Add document-level event listeners
    document.addEventListener("pointermove", handleDocumentPointerMove, { capture: true })
    document.addEventListener("pointerup", handleDocumentPointerUp, { capture: true })

    return () => {
      // Cleanup document-level listeners
      document.removeEventListener("pointermove", handleDocumentPointerMove, { capture: true })
      document.removeEventListener("pointerup", handleDocumentPointerUp, { capture: true })
      console.log("🌍 Document-level capture cleaned up")
    }
  }, [
    isGlobalCaptureActive,
    isResizing,
    convertScreenToNormalizedCoords,
    handleSelectionMouseMove,
    handleSelectionMouseUp,
  ])

  // クリーンアップ用のuseEffect
  useEffect(() => {
    return () => {
      // コンポーネントアンマウント時にキャプチャをクリーンアップ
      stopPointerCapture()
    }
  }, [stopPointerCapture])

  return {
    handleSelectionMouseDown,
    handleSelectionMouseMove,
    handleSelectionMouseUp,
  }
}
