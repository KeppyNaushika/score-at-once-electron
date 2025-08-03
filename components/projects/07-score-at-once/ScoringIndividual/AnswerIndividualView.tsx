/* eslint-disable @next/next/no-img-element */
"use client"

import { useCallback } from "react"
import { DrawingToolPalette } from "./DrawingToolPalette"
import { TextInputModal } from "./TextInputModal"
import { ZOOM_SETTINGS } from "./constants/drawing-constants"
import { useAnswerIndividualEvents } from "./hooks/useAnswerIndividualEvents"
import { useDrawingState } from "./hooks/useDrawingState"
import { useImageCanvas } from "./hooks/useImageCanvas"
import { useImageNavigation } from "./hooks/useImageNavigation"
import type { AnswerIndividualViewProps } from "./types/answer-individual-types"

export default function AnswerIndividualView({
  scoringDatas,
  currentScoringDataId,
  currentCropRegion,
  onScoringDataScore,
  pageImages,
  showMultiplePages = true, // 常に複数ページ表示
  pageSpacing = 20,
}: AnswerIndividualViewProps) {
  // 画像ナビゲーション状態管理（内部管理）
  const { zoom, position, onZoomChange, onPositionChange } =
    useImageNavigation()

  // 描画状態管理
  const drawingState = useDrawingState()

  // 現在表示中の採点データを取得（簡潔に）
  const currentScoringData =
    scoringDatas.find(
      (scoringData) => scoringData.id === currentScoringDataId,
    ) ?? null

  // currentCropRegionはすでにpropsで渡されている（派生済み）

  // 画像とキャンバス管理
  const { canvasRef, imageRef, containerRef, imageLoaded, loadedImages } =
    useImageCanvas({
      currentScoringData,
      currentCropRegion,
      pageImages,
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
  const { handleMouseDown, handleMouseMove, handleMouseUp } =
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

  // ズーム操作（CSS scale + scroll 方式）
  const handleZoomIn = useCallback(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const viewportCenterX = container.offsetWidth / 2
    const viewportCenterY = container.offsetHeight / 2

    const newZoom = Math.min(
      zoom * ZOOM_SETTINGS.zoomInDelta,
      ZOOM_SETTINGS.max,
    )

    // 現在のスクロール位置から、ビューポート中心の画像上の座標を計算
    const currentScrollCenterX = container.scrollLeft + viewportCenterX
    const currentScrollCenterY = container.scrollTop + viewportCenterY

    // スケール前の画像上の座標（zoom倍される前の実座標）
    const imageCenterX = currentScrollCenterX / zoom
    const imageCenterY = currentScrollCenterY / zoom

    // 新しいズームでの同じ画像位置の画面座標
    const newScrollCenterX = imageCenterX * newZoom
    const newScrollCenterY = imageCenterY * newZoom

    // ビューポート中心を維持するための新しいスクロール位置
    const newScrollLeft = newScrollCenterX - viewportCenterX
    const newScrollTop = newScrollCenterY - viewportCenterY

    onZoomChange(newZoom)

    // スクロール位置を調整（次のフレームで実行）
    requestAnimationFrame(() => {
      container.scrollTo(newScrollLeft, newScrollTop)
    })
  }, [zoom, onZoomChange, containerRef])

  const handleZoomOut = useCallback(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const viewportCenterX = container.offsetWidth / 2
    const viewportCenterY = container.offsetHeight / 2

    const newZoom = Math.max(zoom * ZOOM_SETTINGS.wheelDelta, ZOOM_SETTINGS.min)

    // 現在のスクロール位置から、ビューポート中心の画像上の座標を計算
    const currentScrollCenterX = container.scrollLeft + viewportCenterX
    const currentScrollCenterY = container.scrollTop + viewportCenterY

    // スケール前の画像上の座標（zoom倍される前の実座標）
    const imageCenterX = currentScrollCenterX / zoom
    const imageCenterY = currentScrollCenterY / zoom

    // 新しいズームでの同じ画像位置の画面座標
    const newScrollCenterX = imageCenterX * newZoom
    const newScrollCenterY = imageCenterY * newZoom

    // ビューポート中心を維持するための新しいスクロール位置
    const newScrollLeft = newScrollCenterX - viewportCenterX
    const newScrollTop = newScrollCenterY - viewportCenterY

    onZoomChange(newZoom)

    // スクロール位置を調整（次のフレームで実行）
    requestAnimationFrame(() => {
      container.scrollTo(newScrollLeft, newScrollTop)
    })
  }, [zoom, onZoomChange, containerRef])

  // 全体表示（CSS scale + scroll 方式）
  const handleMaximizeView = useCallback(() => {
    if (!containerRef.current || !imageLoaded || loadedImages.length === 0)
      return

    const container = containerRef.current
    const availableWidth = container.offsetWidth
    const availableHeight = container.offsetHeight

    // パディングを考慮
    const padding = 40
    const effectiveWidth = availableWidth - padding
    const effectiveHeight = availableHeight - padding

    // 全画像の合計サイズを計算
    const firstImg = loadedImages[0]
    const totalWidth = firstImg.naturalWidth
    const totalHeight = loadedImages.reduce(
      (total, img, index) =>
        total +
        img.naturalHeight +
        (index < loadedImages.length - 1 ? pageSpacing || 20 : 0),
      0,
    )

    // 全体をコンテナに収めるためのズームを計算
    const zoomByWidth = effectiveWidth / totalWidth
    const zoomByHeight = effectiveHeight / totalHeight
    const newZoom = Math.min(zoomByWidth, zoomByHeight)

    // ズーム制限を適用
    const constrainedZoom = Math.min(
      Math.max(newZoom, ZOOM_SETTINGS.min),
      ZOOM_SETTINGS.max,
    )

    onZoomChange(constrainedZoom)

    // 中央に配置するためのスクロール位置を計算
    const scaledWidth = totalWidth * constrainedZoom
    const scaledHeight = totalHeight * constrainedZoom
    const scrollLeft = (scaledWidth - availableWidth) / 2
    const scrollTop = (scaledHeight - availableHeight) / 2

    // スクロール位置を設定（次のフレームで実行）
    requestAnimationFrame(() => {
      container.scrollTo(Math.max(0, scrollLeft), Math.max(0, scrollTop))
    })
  }, [containerRef, imageLoaded, loadedImages, pageSpacing, onZoomChange])

  // 設問表示（CSS scale + scroll 方式）
  const handleCropView = useCallback(() => {
    if (
      !currentCropRegion ||
      !containerRef.current ||
      !imageLoaded ||
      loadedImages.length === 0
    )
      return

    const container = containerRef.current
    const availableWidth = container.offsetWidth
    const availableHeight = container.offsetHeight

    // パディングを考慮
    const padding = 40
    const effectiveWidth = availableWidth - padding
    const effectiveHeight = availableHeight - padding

    // 設問が属するページの画像を使用
    const questionPageNumber = currentCropRegion.projectPage?.pageNumber || 1
    const questionPageIndex = questionPageNumber - 1 // 1ベース→0ベースに変換

    const questionImg = loadedImages[questionPageIndex] || loadedImages[0]
    if (!questionImg) {
      return
    }

    // 設問領域の実際のサイズ（ピクセル）
    const questionWidth = currentCropRegion.width * questionImg.naturalWidth
    const questionHeight = currentCropRegion.height * questionImg.naturalHeight

    // 設問領域をコンテナに収めるためのズームを計算
    const zoomByWidth = effectiveWidth / questionWidth
    const zoomByHeight = effectiveHeight / questionHeight
    let newZoom = Math.min(zoomByWidth, zoomByHeight)

    // ズーム制限を適用
    newZoom = Math.min(newZoom, ZOOM_SETTINGS.max)
    newZoom = Math.max(newZoom, ZOOM_SETTINGS.min)

    // 設問領域の中心座標（設問ページの画像内の実際のピクセル座標）
    const questionCenterX =
      (currentCropRegion.x + currentCropRegion.width / 2) *
      questionImg.naturalWidth
    const questionCenterY =
      (currentCropRegion.y + currentCropRegion.height / 2) *
      questionImg.naturalHeight

    // 複数ページ表示の場合、設問が属するページのオフセットを計算
    let pageOffsetY = 0

    if (loadedImages.length > 1) {
      const spacing = pageSpacing || 20

      for (let i = 0; i < questionPageIndex; i++) {
        if (i < loadedImages.length) {
          pageOffsetY += loadedImages[i].naturalHeight + spacing
        }
      }
    }

    // 画像の中央配置オフセットを考慮（Canvas幅は最初の画像幅）
    const canvasWidth = loadedImages[0].naturalWidth
    const imageOffsetX = (canvasWidth - questionImg.naturalWidth) / 2

    onZoomChange(newZoom)

    // ズーム変更後に正しいCanvas座標で再計算（次のフレームで実行）
    requestAnimationFrame(() => {
      // 設問の実際のCanvas上での位置（ズーム適用後）
      const questionCenterScreenX = (questionCenterX + imageOffsetX) * newZoom
      const questionCenterScreenY = (questionCenterY + pageOffsetY) * newZoom

      // コンテナ中心座標（現在のコンテナサイズを使用）
      const containerCenterX = container.offsetWidth / 2
      const containerCenterY = container.offsetHeight / 2

      // 設問中心をコンテナ中心に配置するためのスクロール位置
      const scrollLeft = questionCenterScreenX - containerCenterX
      const scrollTop = questionCenterScreenY - containerCenterY

      console.log("🎯 設問表示デバッグ:", {
        zoom: newZoom,
        questionCenter: { questionCenterX, questionCenterY },
        screenCenter: { questionCenterScreenX, questionCenterScreenY },
        containerCenter: { containerCenterX, containerCenterY },
        scroll: { scrollLeft, scrollTop },
        offsets: { imageOffsetX, pageOffsetY },
      })

      // スクロール位置を設定
      container.scrollTo(scrollLeft, scrollTop)
    })
  }, [
    currentCropRegion,
    containerRef,
    imageLoaded,
    loadedImages,
    onZoomChange,
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

  // 採点データが選択されていない場合の早期リターン
  if (!currentScoringData) {
    return (
      <div className="flex h-full items-center justify-center bg-gray-50 text-gray-500">
        採点データを選択してください
      </div>
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* CSS スクロール + scale 方式のメインキャンバス */}
      <div
        ref={containerRef}
        className="grid h-full w-full overflow-auto"
        style={{
          cursor: drawingState.currentTool === "hand" ? "grab" : "crosshair",
        }}
      >
        <div
          className="relative grid place-items-center"
          style={{
            width:
              loadedImages.length > 0
                ? `${loadedImages[0].naturalWidth * zoom}px`
                : `${800 * zoom}px`,
            height:
              loadedImages.length > 0
                ? `${
                    loadedImages.reduce(
                      (total, img, index) =>
                        total +
                        img.naturalHeight +
                        (index < loadedImages.length - 1
                          ? pageSpacing || 20
                          : 0),
                      0,
                    ) * zoom
                  }px`
                : `${600 * zoom}px`,
            minWidth: "100%",
            minHeight: "100%",
          }}
        >
          <canvas
            ref={canvasRef}
            width={loadedImages.length > 0 ? loadedImages[0].naturalWidth : 800}
            height={
              loadedImages.length > 0
                ? loadedImages.reduce(
                    (total, img, index) =>
                      total +
                      img.naturalHeight +
                      (index < loadedImages.length - 1 ? pageSpacing || 20 : 0),
                    0,
                  )
                : 600
            }
            className="block"
            style={{
              width:
                loadedImages.length > 0
                  ? `${loadedImages[0].naturalWidth * zoom}px`
                  : `${800 * zoom}px`,
              height:
                loadedImages.length > 0
                  ? `${
                      loadedImages.reduce(
                        (total, img, index) =>
                          total +
                          img.naturalHeight +
                          (index < loadedImages.length - 1
                            ? pageSpacing || 20
                            : 0),
                        0,
                      ) * zoom
                    }px`
                  : `${600 * zoom}px`,
              imageRendering: "pixelated", // 拡大時のぼけを防止
              transform: "translateZ(0)", // ハードウェアアクセラレーション有効化
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>
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
        currentCropRegion={currentCropRegion || undefined}
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
        onLoad={(e) => {
          const img = e.target as HTMLImageElement
          console.log("🖼️ Hidden img element loaded:", {
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            src: img.src,
            complete: img.complete
          })
        }}
        onError={(e) => {
          console.error("🚫 Hidden img element failed to load:", e)
        }}
      />
    </div>
  )
}
