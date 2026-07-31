"use client"

import { useParams } from "next/navigation"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { getScoringStatusFromArray } from "@/components/exams/07-score-at-once/types"
import type { LineStyle } from "@/types/drawingAnnotation.types"
import type { AnswerOverlaySettings } from "@/types/scoringOverlay.types"
import { DEFAULT_ANSWER_OVERLAY_SETTINGS } from "@/types/scoringOverlay.types"

import { DrawingToolPalette } from "./DrawingToolPalette"
import { useDrawingState } from "./hooks/core/useDrawingState"
import { useImageCanvas } from "./hooks/core/useImageCanvas"
import { useImageNavigation } from "./hooks/navigation/useImageNavigation"
import { useAnswerIndividualEvents } from "./hooks/useAnswerIndividualEvents"
import { useAllStudentAnnotations } from "./hooks/view/useAllStudentAnnotations"
import { useAutoCreateQuestionScore } from "./hooks/view/useAutoCreateQuestionScore"
import { useCanvasIntegration } from "./hooks/view/useCanvasIntegration"
import { useDrawingToolShortcuts } from "./hooks/view/useDrawingToolShortcuts"
import { useQuestionAutoScroll } from "./hooks/view/useQuestionAutoScroll"
import { useZoomAndScroll } from "./hooks/view/useZoomAndScroll"
import { RichTextEditorModal } from "./RichTextEditorModal"
import type { AnswerIndividualViewProps } from "./types"

export default function AnswerIndividualView({
  scoringDatas,
  currentScoringDataId,
  currentCropRegion,
  cropRegions,
  studentAnswerImages,
  showMultiplePages = true, // 常に複数ページ表示
  pageSpacing = 20,
  currentExamStudentId,
  currentUserId,
  questionScores,
  onQuestionScoreCreated,
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
  const [scoringMarkConfig, setAnswerOverlaySettings] =
    useState<AnswerOverlaySettings>(DEFAULT_ANSWER_OVERLAY_SETTINGS)

  useEffect(() => {
    if (!examId || !window.electronAPI?.settings) return
    ;(async () => {
      const result =
        await window.electronAPI.settings.getExamExportSettings(examId)
      if (result.success && result.settings) {
        setAnswerOverlaySettings(result.settings.answerOverlay)
      }
    })()
  }, [examId])

  // 現在表示中の採点データを取得
  const currentScoringData =
    scoringDatas.find(
      (scoringData) => scoringData.id === currentScoringDataId
    ) ?? null

  // 全設問の採点ステータスと点数を計算（全設問マーク・点数描画用）
  const allCropRegionsWithStatus = useMemo(() => {
    if (!cropRegions || !questionScores || !currentScoringData) return []
    const examStudentId = currentScoringData.examStudentId
    return cropRegions.map((cropRegion) => {
      const status = getScoringStatusFromArray(
        questionScores,
        examStudentId,
        cropRegion.id
      )
      const questionScore = questionScores.find(
        (candidateQuestionScore) =>
          candidateQuestionScore.examStudentId === examStudentId &&
          candidateQuestionScore.cropRegionId === cropRegion.id
      )
      const maxScore = cropRegion.points ?? 0
      let actualScore: number | null = null
      switch (status) {
        case "correct":
          actualScore = maxScore
          break
        case "incorrect":
        case "no_answer":
          actualScore = 0
          break
        case "partial":
        case "pending":
          actualScore =
            questionScore?.partialScore != null
              ? Number(questionScore.partialScore)
              : null
          break
      }
      return { cropRegion, status, actualScore }
    })
  }, [cropRegions, questionScores, currentScoringData])

  // QuestionScore自動作成フック（設問表示時にQuestionScoreが存在しない場合は自動作成）
  const { currentQuestionScoreId } = useAutoCreateQuestionScore({
    currentExamStudentId,
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
      currentExamStudentId,
      currentCropRegionId: currentCropRegion?.id,
      currentUserId,
    },
    onAnnotationChanged
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
    textBoundsCache,
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
  // useLayoutEffectでDOMコミット直後に確実に設定
  useLayoutEffect(() => {
    if (scrollContainerRef && containerRef.current) {
      ;(
        scrollContainerRef as React.MutableRefObject<HTMLDivElement | null>
      ).current = containerRef.current
    }
  })

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
      removeDrawingElement: drawingState.removeDrawingElement,
      // テキストアンカー・再編集機能
      onTextAnchorClick: handleTextAnchorClick,
      onTextElementReClick: handleTextElementReClick,
      // Shift制約で正円/正方形にするため
      imageAspectRatio,
      // テキスト境界キャッシュ（ヒットテスト用）
      textBoundsCache,
    })

  // お気に入りアノテーションIDのセット
  const favoriteElementIds = useMemo(() => {
    const ids = new Set<string>()
    for (const element of drawingState.drawingElements) {
      if ((element as { isFavorite?: boolean }).isFavorite) {
        ids.add(element.id)
      }
    }
    return ids
  }, [drawingState.drawingElements])

  // お気に入り切替ハンドラ
  const handleToggleFavorite = useCallback(
    async (elementIds: string[]) => {
      for (const elementId of elementIds) {
        const isFavorite = favoriteElementIds.has(elementId)
        try {
          const result = await window.electronAPI.drawing.toggleFavorite(
            elementId,
            !isFavorite
          )
          if (result.success) {
            // ローカル状態を更新
            drawingState.setDrawingElements(
              (prev: typeof drawingState.drawingElements) =>
                prev.map((element: (typeof prev)[number]) =>
                  element.id === elementId
                    ? { ...element, isFavorite: !isFavorite }
                    : element
                )
            )
          }
        } catch (error) {
          console.error("お気に入り切替エラー:", error)
        }
      }
    },
    [favoriteElementIds, drawingState]
  )

  // 模範解答オーバーレイ用の画像読み込み（全ページ）
  const [masterOverlayImages, setMasterOverlayImages] = useState<
    HTMLImageElement[]
  >([])
  useEffect(() => {
    if (!masterOverlayImageUrls || masterOverlayImageUrls.length === 0) {
      setMasterOverlayImages([])
      return
    }
    let cancelled = false
    const loadAll = async () => {
      const results = await Promise.allSettled(
        masterOverlayImageUrls.map(
          (url) =>
            new Promise<HTMLImageElement>((resolve, reject) => {
              const image = new Image()
              image.onload = () => resolve(image)
              image.onerror = reject
              image.src = url
            })
        )
      )
      if (cancelled) return
      setMasterOverlayImages(
        results
          .filter(
            (result): result is PromiseFulfilledResult<HTMLImageElement> =>
              result.status === "fulfilled"
          )
          .map((result) => result.value)
      )
    }
    loadAll()
    return () => {
      cancelled = true
    }
  }, [masterOverlayImageUrls])

  // 答案コンテンツの自然サイズ（ズーム前、ピクセル単位）
  const answerNaturalWidth =
    loadedImages.length > 0 ? loadedImages[0].naturalWidth : 800
  const answerNaturalHeight =
    loadedImages.length > 0
      ? loadedImages.reduce(
          (total, image, index) =>
            total +
            image.naturalHeight +
            (index < loadedImages.length - 1 ? pageSpacing || 20 : 0),
          0
        )
      : 600

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
            width: `${answerNaturalWidth * zoom}px`,
            height: `${answerNaturalHeight * zoom}px`,
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
                    (total, image, index) =>
                      total +
                      image.naturalHeight +
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
                        (total, image, index) =>
                          total +
                          image.naturalHeight +
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
                    (total, image, index) =>
                      total +
                      image.naturalHeight +
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
                        (total, image, index) =>
                          total +
                          image.naturalHeight +
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
                    (total, image, index) =>
                      total +
                      image.naturalHeight +
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
                        (total, image, index) =>
                          total +
                          image.naturalHeight +
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
          {/* 模範解答オーバーレイ画像（overlay モード時・ページごとに描画） */}
          {isOverlayMode &&
            masterOverlayImages.length > 0 &&
            masterOverlayImages.map((masterImage, pageIndex) => {
              let pageOffsetY = 0
              for (let i = 0; i < pageIndex; i++) {
                const sourceImage = loadedImages[i] || masterOverlayImages[i]
                if (sourceImage) {
                  pageOffsetY += sourceImage.naturalHeight + (pageSpacing || 20)
                }
              }
              const pageImage = loadedImages[pageIndex]
              const pageWidth = pageImage
                ? pageImage.naturalWidth
                : masterImage.naturalWidth
              const pageHeight = pageImage
                ? pageImage.naturalHeight
                : masterImage.naturalHeight

              return (
                <img
                  key={`master-overlay-${pageIndex}`}
                  src={masterImage.src}
                  alt={`模範解答 ページ${pageIndex + 1}`}
                  className="pointer-events-none absolute left-0 block"
                  style={{
                    top: `${pageOffsetY * zoom}px`,
                    width: `${pageWidth * zoom}px`,
                    height: `${pageHeight * zoom}px`,
                    imageRendering: "pixelated",
                    opacity: masterOverlayVisible
                      ? masterOverlayOpacity / 100
                      : 0,
                    transition: "opacity 0.15s ease-in-out",
                  }}
                  draggable={false}
                />
              )
            })}
        </div>
      </div>

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
            <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
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

      {/* 高品質テキストエディターモーダル */}
      <RichTextEditorModal
        open={textboxIntegration.showTextboxModal}
        onOpenChange={(open) => !open && textboxIntegration.closeTextboxModal()}
        value={textboxIntegration.currentTextValue}
        onValueChange={textboxIntegration.setCurrentTextValue}
        color={textboxIntegration.currentTextColor}
        onColorChange={textboxIntegration.setCurrentTextColor}
        onSubmit={textboxIntegration.confirmText}
        onCancel={textboxIntegration.cancelEdit}
        title="高品質テキスト編集"
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
