/* eslint-disable @next/next/no-img-element */
"use client"

import { useCallback } from "react"
import { ZOOM_SETTINGS } from "./constants/drawing-constants"
import { useAnswerIndividualEvents } from "./hooks/useAnswerIndividualEvents"
import { useDrawingState } from "./hooks/useDrawingState"
import { useImageCanvas } from "./hooks/useImageCanvas"
import { useImageNavigation } from "./hooks/useImageNavigation"
import type { AnswerIndividualViewProps } from "./types/answer-individual-types"
import { DrawingToolPalette } from "./components/DrawingToolPalette"
import { TextInputModal } from "./components/TextInputModal"

export default function AnswerIndividualView({
  answerSheet,
  currentQuestion,
  allAnswerSheets,
  showMultiplePages = true, // 常に複数ページ表示
  pageSpacing = 20,
}: Omit<AnswerIndividualViewProps, 'zoom' | 'position' | 'onZoomChange' | 'onPositionChange'>) {
  // 画像ナビゲーション状態管理（内部管理）
  const { zoom, position, onZoomChange, onPositionChange } = useImageNavigation()
  
  // 描画状態管理
  const drawingState = useDrawingState()

  // 画像とキャンバス管理
  const { canvasRef, imageRef, containerRef, imageLoaded, loadedImages } =
    useImageCanvas({
      answerSheet,
      currentQuestion,
      allAnswerSheets,
      zoom,
      position,
      drawingElements: drawingState.drawingElements,
      currentDrawing: drawingState.currentDrawing,
      isDrawing: drawingState.isDrawing,
      isCreatingTextBox: drawingState.isCreatingTextBox,
      strokeColor: drawingState.strokeColor,
      strokeWidth: drawingState.strokeWidth,
      lineStyle: drawingState.lineStyle,
      isShiftPressed: drawingState.isShiftPressed,
      selectedElementId: drawingState.selectedElementId,
      showMultiplePages,
      pageSpacing,
    })

  // イベントハンドリング
  const { handleWheel, handleMouseDown, handleMouseMove, handleMouseUp } =
    useAnswerIndividualEvents({
      canvasRef,
      containerRef,
      imageRef,
      zoom,
      position,
      onZoomChange,
      onPositionChange,
      imageLoaded,
      currentTool: drawingState.currentTool,
      drawingElements: drawingState.drawingElements,
      selectedElementId: drawingState.selectedElementId,
      isDraggingElement: drawingState.isDraggingElement,
      isDrawing: drawingState.isDrawing,
      currentDrawing: drawingState.currentDrawing,
      strokeColor: drawingState.strokeColor,
      strokeWidth: drawingState.strokeWidth,
      lineStyle: drawingState.lineStyle,
      isShiftPressed: drawingState.isShiftPressed,
      dragElementOffset: drawingState.dragElementOffset,
      lineEditMode: drawingState.lineEditMode,
      rectangleEditMode: drawingState.rectangleEditMode,
      isCreatingTextBox: drawingState.isCreatingTextBox,
      showTextInput: drawingState.showTextInput,
      textInputPosition: drawingState.textInputPosition,
      textInputValue: drawingState.textInputValue,
      setSelectedElementId: drawingState.setSelectedElementId,
      setIsDraggingElement: drawingState.setIsDraggingElement,
      setIsDrawing: drawingState.setIsDrawing,
      setCurrentDrawing: drawingState.setCurrentDrawing,
      setDragElementOffset: drawingState.setDragElementOffset,
      setLineEditMode: drawingState.setLineEditMode,
      setRectangleEditMode: drawingState.setRectangleEditMode,
      setIsCreatingTextBox: drawingState.setIsCreatingTextBox,
      setShowTextInput: drawingState.setShowTextInput,
      setTextInputPosition: drawingState.setTextInputPosition,
      setTextInputValue: drawingState.setTextInputValue,
      setIsShiftPressed: drawingState.setIsShiftPressed,
      addDrawingElement: drawingState.addDrawingElement,
      updateDrawingElement: drawingState.updateDrawingElement,
      removeDrawingElement: drawingState.removeDrawingElement,
    })

  // ズーム操作（表示されている部分の中央を基準）
  const handleZoomIn = useCallback(() => {
    if (!containerRef.current) return

    // 現在の表示領域の中央座標を取得
    const container = containerRef.current
    const viewportCenterX = container.offsetWidth / 2
    const viewportCenterY = container.offsetHeight / 2

    const newZoom = Math.min(
      zoom * ZOOM_SETTINGS.zoomInDelta,
      ZOOM_SETTINGS.max,
    )

    // ズーム比率を計算
    const zoomRatio = newZoom / zoom

    // 中央を基準にした位置調整
    const centerAdjustX = viewportCenterX * (1 - zoomRatio)
    const centerAdjustY = viewportCenterY * (1 - zoomRatio)

    const newPosition = {
      x: position.x * zoomRatio + centerAdjustX,
      y: position.y * zoomRatio + centerAdjustY,
    }

    onZoomChange(newZoom)
    onPositionChange(newPosition)
  }, [zoom, position, onZoomChange, onPositionChange, containerRef])

  const handleZoomOut = useCallback(() => {
    if (!containerRef.current) return

    // 現在の表示領域の中央座標を取得
    const container = containerRef.current
    const viewportCenterX = container.offsetWidth / 2
    const viewportCenterY = container.offsetHeight / 2

    const newZoom = Math.max(zoom * ZOOM_SETTINGS.wheelDelta, ZOOM_SETTINGS.min)

    // ズーム比率を計算
    const zoomRatio = newZoom / zoom

    // 中央を基準にした位置調整
    const centerAdjustX = viewportCenterX * (1 - zoomRatio)
    const centerAdjustY = viewportCenterY * (1 - zoomRatio)

    const newPosition = {
      x: position.x * zoomRatio + centerAdjustX,
      y: position.y * zoomRatio + centerAdjustY,
    }

    onZoomChange(newZoom)
    onPositionChange(newPosition)
  }, [zoom, position, onZoomChange, onPositionChange, containerRef])

  // 全体表示
  const handleMaximizeView = useCallback(() => {
    if (!containerRef.current || !imageLoaded || loadedImages.length === 0)
      return

    const container = containerRef.current
    const availableWidth = container.offsetWidth
    const availableHeight = container.offsetHeight

    console.log("=== 全体表示計算 ===", {
      containerSize: { width: availableWidth, height: availableHeight },
      loadedImagesCount: loadedImages.length,
    })

    // パディングを考慮（実際の表示領域）
    const padding = 40 // 上下左右20pxずつ
    const effectiveWidth = availableWidth - padding
    const effectiveHeight = availableHeight - padding

    console.log("有効表示領域:", { effectiveWidth, effectiveHeight })

    // 実際に読み込まれた画像を使用
    const firstImg = loadedImages[0]
    if (!firstImg) {
      console.log("画像が読み込まれていません")
      return
    }

    let newZoom: number

    if (loadedImages.length > 1) {
      // 複数ページの場合：総高さを計算
      const spacing = pageSpacing || 20
      const totalHeight =
        loadedImages.length * firstImg.naturalHeight +
        (loadedImages.length - 1) * spacing

      console.log("画像情報:", {
        naturalWidth: firstImg.naturalWidth,
        naturalHeight: firstImg.naturalHeight,
        pageCount: loadedImages.length,
        spacing,
        totalHeight,
      })

      // 幅基準と高さ基準のズームを計算
      const zoomByWidth = effectiveWidth / firstImg.naturalWidth
      const zoomByHeight = effectiveHeight / totalHeight

      console.log("ズーム計算:", { zoomByWidth, zoomByHeight })

      // 小さい方を採用（全体が入るように）
      newZoom = Math.min(zoomByWidth, zoomByHeight)
      console.log("選択されたズーム（制限前）:", newZoom)
    } else {
      // 1ページのみの場合
      const zoomByWidth = effectiveWidth / firstImg.naturalWidth
      const zoomByHeight = effectiveHeight / firstImg.naturalHeight
      console.log("単一ページ計算:", { zoomByWidth, zoomByHeight })
      newZoom = Math.min(zoomByWidth, zoomByHeight)
    }

    // ズーム制限を適用
    const finalZoom = Math.min(newZoom, ZOOM_SETTINGS.max)
    const clampedZoom = Math.max(finalZoom, ZOOM_SETTINGS.min)

    console.log("最終ズーム:", {
      計算値: newZoom,
      max制限後: finalZoom,
      min制限後: clampedZoom,
      制限値: { min: ZOOM_SETTINGS.min, max: ZOOM_SETTINGS.max },
    })

    onZoomChange(clampedZoom)
    onPositionChange({ x: 0, y: 0 })
  }, [
    containerRef,
    imageLoaded,
    loadedImages,
    onZoomChange,
    onPositionChange,
    pageSpacing,
  ])

  // 設問表示
  const handleCropView = useCallback(() => {
    if (
      !currentQuestion ||
      !containerRef.current ||
      !imageLoaded ||
      loadedImages.length === 0
    )
      return

    const container = containerRef.current
    const availableWidth = container.offsetWidth
    const availableHeight = container.offsetHeight

    console.log("=== 設問表示計算 ===", {
      containerSize: { width: availableWidth, height: availableHeight },
      loadedImagesCount: loadedImages.length,
      questionRegion: {
        x: currentQuestion.x,
        y: currentQuestion.y,
        width: currentQuestion.width,
        height: currentQuestion.height,
      },
    })

    // パディングを考慮
    const padding = 40
    const effectiveWidth = availableWidth - padding
    const effectiveHeight = availableHeight - padding

    // 設問が属するページの画像を使用
    const questionPageNumber = currentQuestion.projectPage?.pageNumber || 1
    const questionPageIndex = questionPageNumber - 1 // 1ベース→0ベースに変換

    const questionImg = loadedImages[questionPageIndex] || loadedImages[0]
    if (!questionImg) {
      console.log("設問ページの画像が読み込まれていません")
      return
    }

    // 設問領域の実際のサイズ（ピクセル）
    const questionWidth = currentQuestion.width * questionImg.naturalWidth
    const questionHeight = currentQuestion.height * questionImg.naturalHeight

    console.log("設問領域サイズ:", {
      questionPageNumber,
      questionPageIndex,
      imageSize: {
        width: questionImg.naturalWidth,
        height: questionImg.naturalHeight,
      },
      questionPixelSize: { width: questionWidth, height: questionHeight },
    })

    // 設問領域をコンテナに収めるためのズームを計算
    const zoomByWidth = effectiveWidth / questionWidth
    const zoomByHeight = effectiveHeight / questionHeight
    let newZoom = Math.min(zoomByWidth, zoomByHeight)

    console.log("設問ズーム計算:", {
      zoomByWidth,
      zoomByHeight,
      selectedZoom: newZoom,
    })

    // ズーム制限を適用
    newZoom = Math.min(newZoom, ZOOM_SETTINGS.max)
    newZoom = Math.max(newZoom, ZOOM_SETTINGS.min)

    // 設問領域の中心座標（設問ページの画像内の実際のピクセル座標）
    const questionCenterX =
      (currentQuestion.x + currentQuestion.width / 2) * questionImg.naturalWidth
    const questionCenterY =
      (currentQuestion.y + currentQuestion.height / 2) *
      questionImg.naturalHeight

    // 複数ページ表示の場合、設問が属するページのオフセットを計算
    let pageOffsetY = 0

    console.log("設問表示 - ページ計算:", {
      questionPageNumber,
      questionPageIndex,
      totalPages: loadedImages.length,
    })

    if (loadedImages.length > 1) {
      const spacing = pageSpacing || 20

      for (let i = 0; i < questionPageIndex; i++) {
        if (i < loadedImages.length) {
          pageOffsetY += loadedImages[i].naturalHeight * newZoom + spacing
        }
      }
    }

    // 設問中心をコンテナ中心に配置するためのパン位置を計算
    const questionCenterScreenX = questionCenterX * newZoom
    const questionCenterScreenY = questionCenterY * newZoom + pageOffsetY

    // コンテナ中心座標
    const containerCenterX = availableWidth / 2
    const containerCenterY = availableHeight / 2

    // パン量を計算（設問中心がコンテナ中心に来るように）
    // Canvas描画と同じ座標系を使用
    // 注意: Canvas描画では各ページが個別に中央揃えされるため、
    // 最初のページ（または設問が属するページ）の表示サイズを基準とする
    const displayWidth = questionImg.naturalWidth * newZoom
    const displayHeight = questionImg.naturalHeight * newZoom

    // Canvasでの画像配置：(canvas.width - displayWidth) / 2 - position.x
    // 設問が属するページの画像サイズで中央揃え計算
    const imageCenterOffsetX = (availableWidth - displayWidth) / 2

    // 設問中心をコンテナ中心に配置するためのパン位置
    // Canvas描画と同じ座標系: offsetX = imageCenterOffsetX - position.x
    // 設問中心がコンテナ中心に来るように: position.x を設定
    const newX = imageCenterOffsetX + questionCenterScreenX - containerCenterX
    const newY = questionCenterScreenY - containerCenterY

    console.log("最終設問表示:", {
      zoom: newZoom,
      panPosition: { x: newX, y: newY },
      questionCenter: { x: questionCenterX, y: questionCenterY },
      screenCenter: { x: questionCenterScreenX, y: questionCenterScreenY },
      pageOffsetY,
      displayWidth,
      containerCenter: { x: containerCenterX, y: containerCenterY },
    })

    onZoomChange(newZoom)
    onPositionChange({ x: newX, y: newY })
  }, [
    currentQuestion,
    containerRef,
    imageLoaded,
    loadedImages,
    onZoomChange,
    onPositionChange,
    pageSpacing,
  ])

  // テキスト送信処理
  const handleTextSubmit = useCallback(() => {
    if (!drawingState.currentDrawing || !drawingState.textInputValue.trim()) {
      drawingState.setShowTextInput(false)
      drawingState.setTextInputValue("")
      drawingState.setCurrentDrawing(null)
      return
    }

    const textElement = {
      ...drawingState.currentDrawing,
      text: drawingState.textInputValue,
    }

    drawingState.addDrawingElement(textElement as any)
    drawingState.setShowTextInput(false)
    drawingState.setTextInputValue("")
    drawingState.setCurrentDrawing(null)
  }, [drawingState])

  // テキストキャンセル処理
  const handleTextCancel = useCallback(() => {
    drawingState.setShowTextInput(false)
    drawingState.setTextInputValue("")
    drawingState.setCurrentDrawing(null)
  }, [drawingState])

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* メインキャンバス */}
      <div
        ref={containerRef}
        className={`h-full w-full ${
          drawingState.currentTool === "hand"
            ? "cursor-grab"
            : "cursor-crosshair"
        }`}
      >
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />
      </div>

      {/* 画像が読み込まれていない場合 */}
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
            <p className="text-muted-foreground text-sm">画像を読み込み中...</p>
          </div>
        </div>
      )}

      {/* 左上パレット */}
      <DrawingToolPalette
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onMaximizeView={handleMaximizeView}
        onCropView={handleCropView}
        currentQuestion={currentQuestion}
        currentTool={drawingState.currentTool}
        onToolChange={drawingState.setCurrentTool}
        strokeColor={drawingState.strokeColor}
        strokeWidth={drawingState.strokeWidth}
        lineStyle={drawingState.lineStyle}
        onStrokeColorChange={drawingState.setStrokeColor}
        onStrokeWidthChange={drawingState.setStrokeWidth}
        onLineStyleChange={(style) => drawingState.setLineStyle(style as any)}
      />

      {/* テキスト入力モーダル */}
      <TextInputModal
        show={drawingState.showTextInput}
        position={drawingState.textInputPosition}
        value={drawingState.textInputValue}
        onValueChange={drawingState.setTextInputValue}
        onSubmit={handleTextSubmit}
        onCancel={handleTextCancel}
      />

      {/* 隠しimg要素（Canvas描画用） */}
      <img
        ref={imageRef}
        className="hidden"
        alt="Answer sheet for canvas drawing"
        draggable={false}
      />
    </div>
  )
}