"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useEffectEvent, useMemo, useRef } from "react"

import { Spinner } from "@/components/ui/spinner"
import { examExportSettingsQuery } from "@/queries/settings"
import type {
  AnnotationTarget,
  LineStyle,
} from "@/types/drawingAnnotation.types"
import { DEFAULT_ANSWER_OVERLAY_SETTINGS } from "@/types/scoringOverlay.types"

import { useContextValue } from "../hooks/useContextValue"
import { AnswerCanvasStack } from "./AnswerCanvasStack"
import { DrawingToolPalette } from "./DrawingToolPalette"
import { useDrawingState } from "./hooks/core/useDrawingState"
import { useImageCanvas } from "./hooks/core/useImageCanvas"
import { useImageNavigation } from "./hooks/navigation/useImageNavigation"
import { useAnswerIndividualEvents } from "./hooks/useAnswerIndividualEvents"
import { useAllStudentAnnotations } from "./hooks/view/useAllStudentAnnotations"
import { useAnnotationFavorites } from "./hooks/view/useAnnotationFavorites"
import { useCanvasIntegration } from "./hooks/view/useCanvasIntegration"
import { useCropRegionsWithStatus } from "./hooks/view/useCropRegionsWithStatus"
import { useDrawingToolShortcuts } from "./hooks/view/useDrawingToolShortcuts"
import { useMasterOverlayImages } from "./hooks/view/useMasterOverlayImages"
import { useQuestionAutoScroll } from "./hooks/view/useQuestionAutoScroll"
import { useZoomAndScroll } from "./hooks/view/useZoomAndScroll"
import { MasterOverlayImages } from "./MasterOverlayImages"
import { RichTextEditorModal } from "./RichTextEditorModal"
import type { AnswerIndividualViewProps } from "./types"
import { stackedCanvasSize } from "./utils/canvasPageLayout"

export default function AnswerIndividualView({
  scoringDatas,
  currentScoringDataId,
  currentCropRegion,
  cropRegions,
  questionScoresByCropRegionId,
  studentAnswerImages,
  showMultiplePages = true, // 常に複数ページ表示
  pageSpacing = 20,
  currentExamStudentId,
  currentUserId,
  onAnnotationChanged,
  annotationRefreshKey,
  masterOverlayImageUrls,
  masterOverlayOpacity = 50,
  masterOverlayVisible = false,
  masterDisplayMode = "overlay",
  onZoomChanged,
  scrollContainerRef,
  onImageSizeChanged,
  pageSize = "A4",
  draftAnnotations,
  fitQuestionOnLoad = false,
}: AnswerIndividualViewProps) {
  // 画像ナビゲーション状態管理（内部管理）
  const {
    zoom,
    position,
    onZoomChange: rawOnZoomChange,
    onPositionChange,
  } = useImageNavigation()

  // zoom変更をラップして外部にも通知
  const onZoomChange = useCallback(
    (newZoom: number) => {
      rawOnZoomChange(newZoom)
      onZoomChanged?.(newZoom)
    },
    [rawOnZoomChange, onZoomChanged]
  )

  // 印字設定（採点マーク・点数表示のプレビュー用）をDBからロード
  const params = useParams()
  const examId = params?.examId as string | undefined
  const { data: exportSettings } = useQuery({
    ...examExportSettingsQuery(examId ?? ""),
    enabled: Boolean(examId),
  })
  const scoringMarkConfig =
    exportSettings?.answerOverlay ?? DEFAULT_ANSWER_OVERLAY_SETTINGS

  // 現在表示中の採点データを取得
  const currentScoringData =
    scoringDatas.find(
      (scoringData) => scoringData.id === currentScoringDataId
    ) ?? null

  // 全設問の採点ステータスと点数を計算（全設問マーク・点数描画用）
  const allCropRegionsWithStatus = useCropRegionsWithStatus({
    cropRegions,
    questionScoresByCropRegionId,
    currentScoringData,
    currentUserId,
  })

  /**
   * 手書き注釈の行き先（答案＋設問＋採点者）。
   *
   * **採点行は持たない。** 行が要るのは注釈を保存するときだけで、用意するのは main。
   * 設問をめくっただけでは何も書き込まれない。
   *
   * 3つの id だけで組み立てる。取り直しのたびに入れ替わる採点領域の実体を持つと、
   * 中身が同じでも別物として扱われて注釈の読み込みが走ってしまう。
   */
  const currentCropRegionId = currentCropRegion?.id
  const annotationTarget = useMemo<AnnotationTarget | null>(
    () =>
      currentExamStudentId && currentCropRegionId && currentUserId
        ? {
            examStudentId: currentExamStudentId,
            cropRegionId: currentCropRegionId,
            userId: currentUserId,
          }
        : null,
    [currentExamStudentId, currentCropRegionId, currentUserId]
  )

  // 描画状態管理（データベース統合対応）。下書きを渡されたら保存しない
  const drawingState = useDrawingState(
    annotationTarget,
    draftAnnotations === undefined,
    onAnnotationChanged,
    draftAnnotations
  )

  // 外部からのアノテーション追加（ブラウザパネルの+ボタン等）後にキャンバスをリロード
  const { loadFromDatabase } = drawingState
  const prevRefreshKeyRef = useRef(annotationRefreshKey)
  useEffect(() => {
    if (
      annotationRefreshKey !== undefined &&
      prevRefreshKeyRef.current !== undefined &&
      annotationRefreshKey !== prevRefreshKeyRef.current
    ) {
      loadFromDatabase()
    }
    prevRefreshKeyRef.current = annotationRefreshKey
  }, [annotationRefreshKey, loadFromDatabase])

  // 透明度制御用：全設問のアノテーション読み込み
  // currentUserIdを渡してログインユーザーのアノテーションのみ取得
  const { allStudentAnnotations } = useAllStudentAnnotations({
    currentExamStudentId,
    currentCropRegion,
    currentUserId,
    refreshKey: annotationRefreshKey,
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
    textBoundsCacheRef,
  } = useImageCanvas({
    currentScoringData,
    currentCropRegion,
    studentAnswerImages,
    zoom,
    position,
    drawingElements: drawingState.drawingElements,
    currentDrawing: drawingState.currentDrawing,
    isDrawing: drawingState.isDrawing,
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
    // 全設問の採点ステータス（全設問マーク描画用）
    allCropRegionsWithStatus,
    // 印字設定（採点マーク・点数表示のプレビュー用）
    scoringMarkConfig,
    pageSize,
  })

  // 画像サイズ通知（split表示のMasterパネルで参照サイズとして使用）
  useEffect(() => {
    if (onImageSizeChanged && loadedImages.length > 0) {
      onImageSizeChanged({
        width: loadedImages[0].naturalWidth,
        heights: loadedImages.map((image) => image.naturalHeight),
      })
    }
  }, [loadedImages, onImageSizeChanged])

  // scrollContainerRefの同期（split表示のスクロール同期用）
  // コールバックrefならDOMのコミットと同時に両方のrefへ行き渡る
  const setContainerElement = useCallback(
    (element: HTMLDivElement | null) => {
      containerRef.current = element
      if (scrollContainerRef) {
        scrollContainerRef.current = element
      }
    },
    [containerRef, scrollContainerRef]
  )

  // Canvas・テキストボックス統合フック
  const {
    canvasWidth,
    canvasHeight,
    imageAspectRatio,
    backgroundImageUrl,
    textboxIntegration,
    handleTextAnchorClick,
    handleTextElementReClick,
  } = useCanvasIntegration({
    loadedImages,
    annotationTarget,
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
      splitMode: null,
    })

  // テキスト編集モーダルが開いていることを、ショートカットの実行条件へ渡す。
  // 採点キー・描画ツールキーの `when` 句はこの `textEditorActive` を読んでおり、
  // 書き手が居ないと常に既定値（false）のまま＝条件として効かない。
  // モーダル内でも書式ボタン等にフォーカスがあれば `inputFocus` は false なので、
  // 入力欄ガードでは覆えない（このフラグでしか止められない）
  useContextValue("textEditorActive", textboxIntegration.showTextboxModal)

  // 描画ツールキーボードショートカット
  useDrawingToolShortcuts({
    setCurrentTool: drawingState.setCurrentTool,
    handleMaximizeView,
    handleCropView,
  })

  // 狭い枠に埋め込むときは、読み込んだら設問に合わせて拡大する（以後は利用者の操作に任せる）
  const fitQuestion = useEffectEvent(() => {
    if (fitQuestionOnLoad) handleCropView()
  })
  useEffect(() => {
    if (imageLoaded) fitQuestion()
  }, [imageLoaded])

  // 設問変更時の自動スクロール
  useQuestionAutoScroll({
    containerRef,
    zoom,
    imageLoaded,
    loadedImages,
    pageSpacing,
    currentCropRegion,
    splitMode: null,
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
      // 複数ページ対応
      loadedImages,
      pageSpacing,
      currentTool: drawingState.currentTool,
      annotationTarget,
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
      // テキスト編集モーダル表示中はキーボードショートカットを無効化
      isTextEditing: textboxIntegration.showTextboxModal,
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
      setIsShiftPressed: drawingState.setIsShiftPressed,
      setIsCtrlPressed: drawingState.setIsCtrlPressed,
      setIsDraggingHandle: drawingState.setIsDraggingHandle,
      setCurrentHandle: drawingState.setCurrentHandle,
      setHoveredElementId: drawingState.setHoveredElementId,
      setDrawingElements: drawingState.setDrawingElements,
      addDrawingElement: drawingState.addDrawingElement,
      updateDrawingElement: drawingState.updateDrawingElement,
      updateDrawingElements: drawingState.updateDrawingElements,
      removeDrawingElement: drawingState.removeDrawingElement,
      // テキストアンカー・再編集機能
      onTextAnchorClick: handleTextAnchorClick,
      onTextElementReClick: handleTextElementReClick,
      // Shift制約で正円/正方形にするため
      imageAspectRatio,
      // テキスト境界キャッシュ（ヒットテスト用）
      textBoundsCacheRef,
    })

  // お気に入り（パレットの★ボタン）
  const { favoriteElementIds, handleToggleFavorite } = useAnnotationFavorites({
    drawingElements: drawingState.drawingElements,
    setDrawingElements: drawingState.setDrawingElements,
  })

  // 模範解答オーバーレイ用の画像読み込み（全ページ）
  const masterOverlayImages = useMasterOverlayImages(masterOverlayImageUrls)

  // 答案コンテンツの自然サイズ（ズーム前、ピクセル単位）
  const answerNaturalSize =
    loadedImages.length > 0
      ? stackedCanvasSize(loadedImages, pageSpacing || 20)
      : { width: 800, height: 600 }

  // overlay表示判定
  const isOverlayMode = masterDisplayMode === "overlay"

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
      <AnswerCanvasStack
        containerRef={setContainerElement}
        canvasRef={canvasRef}
        textCanvasRef={textCanvasRef}
        overlayCanvasRef={overlayCanvasRef}
        naturalWidth={answerNaturalSize.width}
        naturalHeight={answerNaturalSize.height}
        zoom={zoom}
        currentTool={drawingState.currentTool}
        isDraggingElement={drawingState.isDraggingElement}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* 模範解答オーバーレイ画像（overlay モード時・ページごとに描画） */}
        {isOverlayMode && (
          <MasterOverlayImages
            masterOverlayImages={masterOverlayImages}
            loadedImages={loadedImages}
            pageSpacing={pageSpacing}
            zoom={zoom}
            masterOverlayVisible={masterOverlayVisible}
            masterOverlayOpacity={masterOverlayOpacity}
          />
        )}
      </AnswerCanvasStack>

      {/* 模範解答ラベル（overlay表示時） */}
      {isOverlayMode &&
        masterOverlayVisible &&
        masterOverlayImages.length > 0 && (
          <div className="pointer-events-none absolute top-2 left-2 z-10 rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white">
            模範解答
          </div>
        )}

      {/* 画像が読み込まれていない場合 */}
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <Spinner className="mx-auto mb-2 size-8 text-blue-600" />
            <p className="text-sm text-muted-foreground">画像を読み込み中...</p>
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
        selectedElements={drawingState.drawingElements.filter((element) =>
          drawingState.selectedElementIds.includes(element.id)
        )}
        onUpdateSelectedElements={drawingState.updateDrawingElements}
        onClearSelection={drawingState.clearSelection}
        onToggleFavorite={handleToggleFavorite}
        favoriteElementIds={favoriteElementIds}
      />

      {/* テキスト編集モーダル */}
      <RichTextEditorModal
        open={textboxIntegration.showTextboxModal}
        onOpenChange={(open) => !open && textboxIntegration.closeTextboxModal()}
        value={textboxIntegration.currentTextValue}
        onValueChange={textboxIntegration.setCurrentTextValue}
        color={textboxIntegration.currentTextColor}
        onColorChange={textboxIntegration.setCurrentTextColor}
        onSubmit={textboxIntegration.confirmText}
        onCancel={textboxIntegration.cancelEdit}
        title="テキスト編集"
        position={textboxIntegration.currentPosition}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
        backgroundImageUrl={backgroundImageUrl}
        fontSize={textboxIntegration.currentFontSize}
        onFontSizeChange={textboxIntegration.setCurrentFontSize}
        anchorDirection={textboxIntegration.currentAnchorDirection}
        onAnchorDirectionChange={textboxIntegration.setCurrentAnchorDirection}
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
