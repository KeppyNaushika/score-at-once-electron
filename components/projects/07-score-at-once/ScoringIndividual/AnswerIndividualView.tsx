"use client"

import { DrawingToolPalette } from "./DrawingToolPalette"
import { RichTextEditorModalV4 } from "./RichTextEditorModalV4"
import { useDrawingState } from "./hooks/core/useDrawingState"
import { useImageCanvas } from "./hooks/core/useImageCanvas"
import { useImageNavigation } from "./hooks/navigation/useImageNavigation"
import { useAnswerIndividualEvents } from "./hooks/useAnswerIndividualEvents"
import {
  useAllStudentAnnotations,
  useAutoCreateQuestionScore,
  useCanvasV4Integration,
  useDrawingToolShortcuts,
  useQuestionAutoScroll,
  useTextInputStateNotifier,
  useZoomAndScroll,
} from "./hooks/view"
import type {
  AnswerIndividualViewProps,
  LineStyle,
} from "./types/answerIndividualTypes"

export default function AnswerIndividualView({
  scoringDatas,
  currentScoringDataId,
  currentCropRegion,
  pageImages,
  showMultiplePages = true, // 常に複数ページ表示
  pageSpacing = 20,
  onTextInputStateChange,
  currentStudentId,
  currentUserId,
  questionScores,
  onQuestionScoreCreated,
}: AnswerIndividualViewProps) {
  // 画像ナビゲーション状態管理（内部管理）
  const { zoom, position, onZoomChange, onPositionChange } =
    useImageNavigation()

  // 現在表示中の採点データを取得
  const currentScoringData =
    scoringDatas.find(
      (scoringData) => scoringData.id === currentScoringDataId
    ) ?? null

  // QuestionScore自動作成フック（設問表示時にQuestionScoreが存在しない場合は自動作成）
  const { currentQuestionScoreId } = useAutoCreateQuestionScore({
    currentStudentId,
    currentCropRegionId: currentCropRegion?.id,
    currentUserId,
    questionScores,
    onQuestionScoreCreated,
  })

  // 描画状態管理（データベース統合対応）
  const drawingState = useDrawingState(
    currentQuestionScoreId,
    true, // データベース永続化を有効化
    {
      currentStudentId,
      currentCropRegionId: currentCropRegion?.id,
      currentUserId,
    }
  )

  // 透明度制御用：全設問のアノテーション読み込み
  // currentUserIdを渡してログインユーザーのアノテーションのみ取得
  const { allStudentAnnotations } = useAllStudentAnnotations({
    currentStudentId,
    currentCropRegion,
    currentUserId,
  })

  // テキスト入力状態変更の通知
  useTextInputStateNotifier({
    showTextInput: drawingState.showTextInput,
    onTextInputStateChange,
  })

  // 画像とキャンバス管理（透明度制御統合）
  const {
    canvasRef,
    overlayCanvasRef,
    textCanvasRef,
    imageRef,
    containerRef,
    imageLoaded,
    loadedImages,
    textBoundsCache,
  } = useImageCanvas({
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
    selectedElementIds: drawingState.selectedElementIds,
    isDrawingSelection: drawingState.isDrawingSelection,
    selectionRectangle: drawingState.selectionRectangle,
    showMultiplePages,
    pageSpacing,
    isDraggingElement: drawingState.isDraggingElement,
    // 透明度制御用の全アノテーション
    allAnnotations: allStudentAnnotations,
    currentCropRegionId: currentCropRegion?.id,
    // ホバー要素ID（ハンドル表示用）
    hoveredElementId: drawingState.hoveredElementId,
  })

  // Canvas・V4統合フック
  const {
    canvasWidth,
    canvasHeight,
    imageAspectRatio,
    backgroundImageUrl,
    v4Integration,
    handleTextAnchorClick,
    handleTextElementReClick,
  } = useCanvasV4Integration({
    loadedImages,
    drawingElements: drawingState.drawingElements,
    setDrawingElements: drawingState.setDrawingElements,
    addDrawingElement: drawingState.addDrawingElement,
    updateDrawingElement: drawingState.updateDrawingElement,
    currentScoringData,
  })

  // ズーム・スクロール操作フック
  const { handleZoomIn, handleZoomOut, handleMaximizeView, handleCropView } =
    useZoomAndScroll({
      containerRef,
      zoom,
      onZoomChange,
      imageLoaded,
      loadedImages,
      pageSpacing,
      currentCropRegion,
    })

  // 描画ツールキーボードショートカット
  useDrawingToolShortcuts({
    setCurrentTool: drawingState.setCurrentTool,
    handleMaximizeView,
    handleCropView,
  })

  // 設問変更時の自動スクロール
  useQuestionAutoScroll({
    containerRef,
    zoom,
    imageLoaded,
    loadedImages,
    pageSpacing,
    currentCropRegion,
  })

  // イベントハンドリング
  const { handlePointerDown, handlePointerMove, handlePointerUp } =
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
      // 複数選択システム
      selectedElementIds: drawingState.selectedElementIds,
      isDraggingElement: drawingState.isDraggingElement,
      isDrawing: drawingState.isDrawing,
      currentDrawing: drawingState.currentDrawing,
      strokeColor: drawingState.strokeColor,
      strokeWidth: drawingState.strokeWidth,
      lineStyle: drawingState.lineStyle,
      isShiftPressed: drawingState.isShiftPressed,
      isCtrlPressed: drawingState.isCtrlPressed,
      dragElementOffset: drawingState.dragElementOffset,
      // 選択範囲ドラッグ
      isDrawingSelection: drawingState.isDrawingSelection,
      selectionRectangle: drawingState.selectionRectangle,
      // その他
      lineEditMode: drawingState.lineEditMode,
      rectangleEditMode: drawingState.rectangleEditMode,
      // テキストボックス関連の状態
      isCreatingTextBox: drawingState.isCreatingTextBox,
      showTextInput: drawingState.showTextInput,
      textInputPosition: drawingState.textInputPosition,
      textInputValue: drawingState.textInputValue,
      isDraggingHandle: drawingState.isDraggingHandle,
      currentHandle: drawingState.currentHandle,
      hoveredElementId: drawingState.hoveredElementId,
      // 複数選択アクション
      setSelectedElementIds: drawingState.setSelectedElementIds,
      addToSelection: drawingState.addToSelection,
      removeFromSelection: drawingState.removeFromSelection,
      toggleSelection: drawingState.toggleSelection,
      clearSelection: drawingState.clearSelection,
      // 選択範囲アクション
      setIsDrawingSelection: drawingState.setIsDrawingSelection,
      setSelectionRectangle: drawingState.setSelectionRectangle,
      selectElementsInRectangle: drawingState.selectElementsInRectangle,
      // その他のアクション
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
      setIsCtrlPressed: drawingState.setIsCtrlPressed,
      setIsDraggingHandle: drawingState.setIsDraggingHandle,
      setCurrentHandle: drawingState.setCurrentHandle,
      setHoveredElementId: drawingState.setHoveredElementId,
      setDrawingElements: drawingState.setDrawingElements,
      addDrawingElement: drawingState.addDrawingElement,
      updateDrawingElement: drawingState.updateDrawingElement,
      removeDrawingElement: drawingState.removeDrawingElement,
      // V4統合: テキストアンカー・再編集機能
      onTextAnchorClick: handleTextAnchorClick,
      onTextElementReClick: handleTextElementReClick,
      // Shift制約で正円/正方形にするため
      imageAspectRatio,
      // テキスト境界キャッシュ（ヒットテスト用）
      textBoundsCache,
    })

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
          cursor:
            drawingState.currentTool === "hand"
              ? drawingState.isDraggingElement
                ? "grabbing"
                : "grab"
              : drawingState.currentTool === "select"
                ? drawingState.isDraggingElement
                  ? "move"
                  : "default"
                : "crosshair",
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
                      0
                    ) * zoom
                  }px`
                : `${600 * zoom}px`,
            minWidth: "100%",
            minHeight: "100%",
          }}
        >
          {/* メインキャンバス（画像・描画要素） */}
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
                    0
                  )
                : 600
            }
            className="absolute top-0 left-0 block"
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
                        0
                      ) * zoom
                    }px`
                  : `${600 * zoom}px`,
              imageRendering: "pixelated", // 拡大時のぼけを防止
              transform: "translateZ(0)", // ハードウェアアクセラレーション有効化
              touchAction: "none", // ポインターイベント用タッチアクション無効化
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />
          {/* テキスト専用キャンバス */}
          <canvas
            ref={textCanvasRef}
            width={loadedImages.length > 0 ? loadedImages[0].naturalWidth : 800}
            height={
              loadedImages.length > 0
                ? loadedImages.reduce(
                    (total, img, index) =>
                      total +
                      img.naturalHeight +
                      (index < loadedImages.length - 1 ? pageSpacing || 20 : 0),
                    0
                  )
                : 600
            }
            className="pointer-events-none absolute top-0 left-0 block"
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
                        0
                      ) * zoom
                    }px`
                  : `${600 * zoom}px`,
              imageRendering: "pixelated",
              transform: "translateZ(0)",
            }}
          />
          {/* オーバーレイキャンバス（ハンドル表示専用） */}
          <canvas
            ref={overlayCanvasRef}
            width={loadedImages.length > 0 ? loadedImages[0].naturalWidth : 800}
            height={
              loadedImages.length > 0
                ? loadedImages.reduce(
                    (total, img, index) =>
                      total +
                      img.naturalHeight +
                      (index < loadedImages.length - 1 ? pageSpacing || 20 : 0),
                    0
                  )
                : 600
            }
            className="pointer-events-none absolute top-0 left-0 block"
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
                        0
                      ) * zoom
                    }px`
                  : `${600 * zoom}px`,
              imageRendering: "pixelated",
              transform: "translateZ(0)",
            }}
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
        containerRef={containerRef}
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
        onLineStyleChange={(style) =>
          drawingState.setLineStyle(style as LineStyle)
        }
        selectedElements={drawingState.drawingElements.filter((el) =>
          drawingState.selectedElementIds.includes(el.id)
        )}
        onUpdateSelectedElements={drawingState.updateDrawingElements}
        onClearSelection={drawingState.clearSelection}
      />

      {/* V4統合: 高品質テキストエディターモーダル */}
      <RichTextEditorModalV4
        open={v4Integration.showV4Modal}
        onOpenChange={(open) => !open && v4Integration.closeV4Modal()}
        value={v4Integration.currentTextValue}
        onValueChange={v4Integration.setCurrentTextValue}
        color={v4Integration.currentTextColor}
        onColorChange={v4Integration.setCurrentTextColor}
        onSubmit={v4Integration.confirmText}
        onCancel={v4Integration.cancelEdit}
        title="高品質テキスト編集 (V4統合)"
        position={v4Integration.currentPosition}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
        backgroundImageUrl={backgroundImageUrl}
        fontSize={v4Integration.currentFontSize}
        onFontSizeChange={v4Integration.setCurrentFontSize}
        anchorDirection={v4Integration.currentAnchorDirection}
        onAnchorDirectionChange={v4Integration.setCurrentAnchorDirection}
      />

      {/* 隠しimg要素（Canvas描画用） */}
      <img
        ref={imageRef}
        className="hidden"
        alt="Answer sheet for canvas drawing"
        draggable={false}
        onLoad={() => {
          // Image loaded - canvas will use imageRef
        }}
        onError={(e) => {
          console.error("Hidden img element failed to load:", e)
        }}
      />
    </div>
  )
}
