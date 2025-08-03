import { useCallback, useEffect } from "react"
import type { DrawingTool } from "../types/answer-individual-types"
import { useDrawingUtils } from "./useDrawingUtils"
import { ZOOM_SETTINGS } from "../constants/drawing-constants"

interface UseAnswerDisplayEventsProps {
  // Canvas and container refs
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  imageRef: React.RefObject<HTMLImageElement | null>

  // Display state
  zoom: number
  position: { x: number; y: number }
  onZoomChange: (zoom: number) => void
  onPositionChange: (position: { x: number; y: number }) => void
  imageLoaded: boolean

  // Drawing state
  currentTool: DrawingTool
  drawingElements: any[]
  selectedElementId: string | null
  isDraggingElement: boolean
  isDrawing: boolean
  currentDrawing: any
  strokeColor: string
  strokeWidth: number
  lineStyle: any
  isShiftPressed: boolean
  dragElementOffset: { x: number; y: number }
  lineEditMode: any
  rectangleEditMode: any
  isCreatingTextBox: boolean
  showTextInput: boolean
  textInputPosition: { x: number; y: number }
  textInputValue: string

  // Drawing actions
  setSelectedElementId: (id: string | null) => void
  setIsDraggingElement: (dragging: boolean) => void
  setIsDrawing: (drawing: boolean) => void
  setCurrentDrawing: (drawing: any) => void
  setDragElementOffset: (offset: { x: number; y: number }) => void
  setLineEditMode: (mode: any) => void
  setRectangleEditMode: (mode: any) => void
  setIsCreatingTextBox: (creating: boolean) => void
  setShowTextInput: (show: boolean) => void
  setTextInputPosition: (position: { x: number; y: number }) => void
  setTextInputValue: (value: string) => void
  setIsShiftPressed: (pressed: boolean) => void
  addDrawingElement: (element: any) => void
  updateDrawingElement: (id: string, updates: any) => void
  removeDrawingElement: (id: string) => void
}

export function useAnswerIndividualEvents(props: UseAnswerDisplayEventsProps) {
  const {
    canvasRef,
    containerRef,
    imageRef,
    zoom,
    position,
    onZoomChange,
    onPositionChange,
    imageLoaded,
    currentTool,
    drawingElements,
    selectedElementId,
    isDraggingElement,
    isDrawing,
    currentDrawing,
    strokeColor,
    strokeWidth,
    lineStyle,
    isShiftPressed,
    dragElementOffset,
    lineEditMode,
    rectangleEditMode,
    isCreatingTextBox,
    showTextInput,
    textInputPosition,
    textInputValue,
    setSelectedElementId,
    setIsDraggingElement,
    setIsDrawing,
    setCurrentDrawing,
    setDragElementOffset,
    setLineEditMode,
    setRectangleEditMode,
    setIsCreatingTextBox,
    setShowTextInput,
    setTextInputPosition,
    setTextInputValue,
    setIsShiftPressed,
    addDrawingElement,
    updateDrawingElement,
    removeDrawingElement,
  } = props

  const {
    hitTestElement,
    getLineEditMode,
    getRectangleEditMode,
    screenToImageCoords,
  } = useDrawingUtils()

  // Passive event listener回避のためのwheel処理
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheelCapture = (e: WheelEvent) => {
      // Ctrl + ホイール: ズーム（マウス位置を基準）
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault() // passive: falseなので動作する

        const rect = container.getBoundingClientRect()
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top

        // ズーム適用
        const zoomDelta =
          e.deltaY > 0 ? ZOOM_SETTINGS.wheelDelta : ZOOM_SETTINGS.zoomInDelta
        const newZoom = Math.min(
          Math.max(zoom * zoomDelta, ZOOM_SETTINGS.min),
          ZOOM_SETTINGS.max,
        )

        // マウス位置を基準とした座標計算
        const currentScrollMouseX = container.scrollLeft + mouseX
        const currentScrollMouseY = container.scrollTop + mouseY

        // スケール前の画像上の座標
        const imageMouseX = currentScrollMouseX / zoom
        const imageMouseY = currentScrollMouseY / zoom

        // 新しいズームでの同じ画像位置の画面座標
        const newScrollMouseX = imageMouseX * newZoom
        const newScrollMouseY = imageMouseY * newZoom

        // マウス位置を維持するための新しいスクロール位置
        const newScrollLeft = newScrollMouseX - mouseX
        const newScrollTop = newScrollMouseY - mouseY

        onZoomChange(newZoom)

        // スクロール位置を調整（次のフレームで実行）
        requestAnimationFrame(() => {
          container.scrollTo(newScrollLeft, newScrollTop)
        })
      }
      // その他のホイール操作はネイティブスクロールに委ねる（preventDefault不要）
    }

    // passive: false を明示指定
    container.addEventListener("wheel", handleWheelCapture, { passive: false })

    return () => {
      container.removeEventListener("wheel", handleWheelCapture)
    }
  }, [containerRef, zoom, onZoomChange])

  // マウスダウン処理（CSS scale + scroll 方式）
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!imageLoaded || !canvasRef.current || !containerRef.current) return

      const canvas = canvasRef.current
      const container = containerRef.current
      const img = imageRef.current
      if (!img) return

      const rect = canvas.getBoundingClientRect()
      const canvasX = e.clientX - rect.left
      const canvasY = e.clientY - rect.top

      // CSS scale方式：Canvas要素自体がzoom倍サイズなので座標変換不要
      const actualX = canvasX
      const actualY = canvasY

      // Canvasでの画像中央配置オフセットを考慮
      // Canvas幅は全画像の最大幅、個別画像は中央配置される
      const canvasElement = canvasRef.current
      if (!canvasElement) return

      const canvasWidth = canvasElement.width
      const imageOffsetX = (canvasWidth - img.naturalWidth) / 2

      // 実際の画像座標に変換（中央配置オフセットを引く）
      const imageX = actualX - imageOffsetX
      const imageY = actualY

      // 画像サイズで正規化（0-1の範囲、NaN防止）
      const imageCoords = {
        x: img.naturalWidth ? imageX / img.naturalWidth : 0,
        y: img.naturalHeight ? imageY / img.naturalHeight : 0,
      }

      // 選択ツールの場合
      if (currentTool === "select") {
        // 既存要素の選択チェック
        let elementSelected = false
        for (let i = drawingElements.length - 1; i >= 0; i--) {
          const element = drawingElements[i]
          if (hitTestElement(element, imageCoords.x, imageCoords.y)) {
            setSelectedElementId(element.id)
            elementSelected = true

            // 編集モードの判定
            if (element.type === "line") {
              const editMode = getLineEditMode(
                element,
                imageCoords.x,
                imageCoords.y,
              )
              setLineEditMode(editMode)
            } else if (element.type === "rectangle") {
              const editMode = getRectangleEditMode(
                element,
                imageCoords.x,
                imageCoords.y,
              )
              setRectangleEditMode(editMode)
            }

            // ドラッグ開始
            setIsDraggingElement(true)
            setDragElementOffset({
              x: imageCoords.x - element.x,
              y: imageCoords.y - element.y,
            })
            break
          }
        }

        if (!elementSelected) {
          setSelectedElementId(null)
          setLineEditMode(null)
          setRectangleEditMode(null)
        }
        return
      }

      // 描画ツールの処理
      if (currentTool === "text") {
        setIsCreatingTextBox(true)
        setIsDrawing(true)
        setCurrentDrawing({
          id: Math.random().toString(36).substr(2, 9),
          type: "text",
          x: imageCoords.x,
          y: imageCoords.y,
          textBoxWidth: 0,
          textBoxHeight: 0,
          color: strokeColor,
          strokeWidth,
          fontSize: 16,
        })
      } else if (currentTool === "line") {
        console.log("🖊️ 直線描画開始:", {
          imageCoords: { x: imageCoords.x, y: imageCoords.y },
          strokeColor,
          strokeWidth,
          lineStyle
        })
        setIsDrawing(true)
        setCurrentDrawing({
          id: Math.random().toString(36).substr(2, 9),
          type: "line",
          x: imageCoords.x,
          y: imageCoords.y,
          endX: imageCoords.x,
          endY: imageCoords.y,
          color: strokeColor,
          strokeWidth,
          lineStyle,
        })
      } else if (currentTool === "rectangle") {
        setIsDrawing(true)
        setCurrentDrawing({
          id: Math.random().toString(36).substr(2, 9),
          type: "rectangle",
          x: imageCoords.x,
          y: imageCoords.y,
          width: 0,
          height: 0,
          color: strokeColor,
          strokeWidth,
        })
      }
    },
    [
      imageLoaded,
      canvasRef,
      containerRef,
      imageRef,
      currentTool,
      drawingElements,
      hitTestElement,
      setSelectedElementId,
      setIsDraggingElement,
      setDragElementOffset,
      getLineEditMode,
      setLineEditMode,
      getRectangleEditMode,
      setRectangleEditMode,
      setIsCreatingTextBox,
      setIsDrawing,
      setCurrentDrawing,
      strokeColor,
      strokeWidth,
      lineStyle,
    ],
  )

  // マウス移動処理（CSS scale + scroll 方式）
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (
        !imageLoaded ||
        !canvasRef.current ||
        !containerRef.current ||
        !imageRef.current
      )
        return

      const canvas = canvasRef.current
      const container = containerRef.current
      const img = imageRef.current

      const rect = canvas.getBoundingClientRect()
      const canvasX = e.clientX - rect.left
      const canvasY = e.clientY - rect.top

      // CSS scale方式：Canvas要素自体がzoom倍サイズなので座標変換不要
      const actualX = canvasX
      const actualY = canvasY

      // Canvasでの画像中央配置オフセットを考慮
      // Canvas幅は全画像の最大幅、個別画像は中央配置される
      const canvasElement = canvasRef.current
      if (!canvasElement) return

      const canvasWidth = canvasElement.width
      const imageOffsetX = (canvasWidth - img.naturalWidth) / 2

      // 実際の画像座標に変換（中央配置オフセットを引く）
      const imageX = actualX - imageOffsetX
      const imageY = actualY

      // 画像サイズで正規化（0-1の範囲、NaN防止）
      const imageCoords = {
        x: img.naturalWidth ? imageX / img.naturalWidth : 0,
        y: img.naturalHeight ? imageY / img.naturalHeight : 0,
      }

      // 要素のドラッグ処理
      if (isDraggingElement && selectedElementId && currentTool === "select") {
        const element = drawingElements.find(
          (el) => el.id === selectedElementId,
        )
        if (element) {
          if (element.type === "line" && lineEditMode) {
            // 線の編集
            if (lineEditMode === "start") {
              updateDrawingElement(selectedElementId, {
                x: imageCoords.x,
                y: imageCoords.y,
              })
            } else if (lineEditMode === "end") {
              updateDrawingElement(selectedElementId, {
                endX: imageCoords.x,
                endY: imageCoords.y,
              })
            } else if (lineEditMode === "move") {
              const deltaX = imageCoords.x - dragElementOffset.x - element.x
              const deltaY = imageCoords.y - dragElementOffset.y - element.y
              updateDrawingElement(selectedElementId, {
                x: element.x + deltaX,
                y: element.y + deltaY,
                endX: element.endX + deltaX,
                endY: element.endY + deltaY,
              })
            }
          } else {
            // 通常の移動
            updateDrawingElement(selectedElementId, {
              x: imageCoords.x - dragElementOffset.x,
              y: imageCoords.y - dragElementOffset.y,
            })
          }
        }
        return
      }

      // 描画中の処理
      if (isDrawing && currentDrawing) {
        if (currentDrawing.type === "text" && isCreatingTextBox) {
          // テキストボックスのサイズ調整
          const width = Math.abs(imageCoords.x - currentDrawing.x)
          const height = Math.abs(imageCoords.y - currentDrawing.y)
          setCurrentDrawing({
            ...currentDrawing,
            textBoxWidth: width,
            textBoxHeight: height,
          })
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
        } else if (currentDrawing.type === "rectangle") {
          // 矩形の描画
          const width = imageCoords.x - currentDrawing.x
          const height = imageCoords.y - currentDrawing.y
          setCurrentDrawing({
            ...currentDrawing,
            width,
            height,
          })
        }
      }
    },
    [
      imageLoaded,
      canvasRef,
      containerRef,
      imageRef,
      isDraggingElement,
      selectedElementId,
      currentTool,
      isDrawing,
      currentDrawing,
      drawingElements,
      lineEditMode,
      updateDrawingElement,
      dragElementOffset.x,
      dragElementOffset.y,
      isCreatingTextBox,
      setCurrentDrawing,
      isShiftPressed,
    ],
  )

  // マウスアップ処理
  const handleMouseUp = useCallback(() => {
    if (isDraggingElement) {
      setIsDraggingElement(false)
      setLineEditMode(null)
      setRectangleEditMode(null)
    }

    if (isDrawing && currentDrawing) {
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
      } else {
        // その他の描画要素の完了
        if (currentDrawing.id) {
          addDrawingElement(currentDrawing as any)
        }
        setIsDrawing(false)
        setCurrentDrawing(null)
      }
    }
  }, [
    isDraggingElement,
    isDrawing,
    currentDrawing,
    setIsDraggingElement,
    setLineEditMode,
    setRectangleEditMode,
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

  // キーボードイベント
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        setIsShiftPressed(true)
      }

      // Delete/Backspaceで選択要素を削除
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedElementId &&
        !showTextInput
      ) {
        e.preventDefault()
        removeDrawingElement(selectedElementId)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") {
        setIsShiftPressed(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)

    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [
    selectedElementId,
    showTextInput,
    setIsShiftPressed,
    removeDrawingElement,
  ])

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  }
}
