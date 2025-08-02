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

  // ホイール操作（ズーム・スクロール）
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()

      // Ctrl + ホイール: ズーム（表示されている部分の中央を基準）
      if (e.ctrlKey || e.metaKey) {
        const canvas = canvasRef.current
        if (!canvas) return

        // 現在の表示領域の中央座標を取得
        const viewportCenterX = canvas.width / 2
        const viewportCenterY = canvas.height / 2

        // ズーム適用
        const zoomDelta =
          e.deltaY > 0 ? ZOOM_SETTINGS.wheelDelta : ZOOM_SETTINGS.zoomInDelta
        const newZoom = Math.min(
          Math.max(zoom * zoomDelta, ZOOM_SETTINGS.min),
          ZOOM_SETTINGS.max,
        )

        // ズーム比率を計算
        const zoomRatio = newZoom / zoom

        // 中央を基準にした位置調整
        // 新しい位置 = 現在の位置 * ズーム比率 + 中央調整
        const centerAdjustX = viewportCenterX * (1 - zoomRatio)
        const centerAdjustY = viewportCenterY * (1 - zoomRatio)

        const newPosition = {
          x: position.x * zoomRatio + centerAdjustX,
          y: position.y * zoomRatio + centerAdjustY,
        }

        onZoomChange(newZoom)
        onPositionChange(newPosition)
        return
      }

      // Shift + ホイール: 横スクロール
      if (e.shiftKey) {
        // macOSではShift+ホイールでdeltaXが設定される
        // deltaXが0の場合はdeltaYを使用（フォールバック）
        const deltaX = e.deltaX !== 0 ? e.deltaX : e.deltaY
        const newPosition = {
          x: position.x + deltaX,
          y: position.y,
        }
        onPositionChange(newPosition)
        return
      }

      // 通常のホイール: 縦・横スクロール
      const newPosition = {
        x: position.x + e.deltaX,
        y: position.y + e.deltaY,
      }
      onPositionChange(newPosition)
    },
    [position.x, position.y, onPositionChange, canvasRef, zoom, onZoomChange],
  )

  // マウスダウン処理
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!imageLoaded || !canvasRef.current || !containerRef.current) return

      const canvas = canvasRef.current
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      // 画像相対座標に変換
      const img = imageRef.current
      if (!img) return

      const displayWidth = img.naturalWidth * zoom
      const displayHeight = img.naturalHeight * zoom
      const offsetX = (canvas.width - displayWidth) / 2 - position.x
      const offsetY = (canvas.height - displayHeight) / 2 - position.y

      const imageCoords = screenToImageCoords(
        x,
        y,
        displayWidth,
        displayHeight,
        offsetX,
        offsetY,
      )

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
      zoom,
      position.x,
      position.y,
      screenToImageCoords,
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

  // マウス移動処理
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!imageLoaded || !canvasRef.current || !imageRef.current) return

      const canvas = canvasRef.current
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const img = imageRef.current
      const displayWidth = img.naturalWidth * zoom
      const displayHeight = img.naturalHeight * zoom
      const offsetX = (canvas.width - displayWidth) / 2 - position.x
      const offsetY = (canvas.height - displayHeight) / 2 - position.y

      const imageCoords = screenToImageCoords(
        x,
        y,
        displayWidth,
        displayHeight,
        offsetX,
        offsetY,
      )

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
      imageRef,
      zoom,
      position.x,
      position.y,
      screenToImageCoords,
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

        // テキスト入力モーダルを表示
        if (
          canvasRef.current &&
          currentDrawing.x !== undefined &&
          currentDrawing.y !== undefined
        ) {
          const img = imageRef.current
          if (img) {
            const displayWidth = img.naturalWidth * zoom
            const displayHeight = img.naturalHeight * zoom
            const offsetX =
              (canvasRef.current.width - displayWidth) / 2 - position.x
            const offsetY =
              (canvasRef.current.height - displayHeight) / 2 - position.y

            const screenX = currentDrawing.x * displayWidth + offsetX
            const screenY = currentDrawing.y * displayHeight + offsetY

            setTextInputPosition({ x: screenX, y: screenY })
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
    imageRef,
    zoom,
    position.x,
    position.y,
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
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  }
}
