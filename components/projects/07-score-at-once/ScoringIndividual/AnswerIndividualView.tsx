/* eslint-disable @next/next/no-img-element */
"use client"

import type { DrawingAnnotation } from "@/types/drawing-annotation.types"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useCommand } from "../hooks/useCommand"
import { DrawingToolPalette } from "./DrawingToolPalette"
import { RichTextEditorModalV4 } from "./RichTextEditorModalV4"
import { ZOOM_SETTINGS } from "./constants/drawing-constants"
import { useDrawingState } from "./hooks/core/useDrawingState"
import { useImageCanvas } from "./hooks/core/useImageCanvas"
import { useImageNavigation } from "./hooks/navigation/useImageNavigation"
import { useTextboxV4Integration } from "./hooks/text/useTextboxIntegration"
import { useAnswerIndividualEvents } from "./hooks/useAnswerIndividualEvents"
import type { AnswerIndividualViewProps } from "./types/answer-individual-types"

export default function AnswerIndividualView({
  scoringDatas,
  currentScoringDataId,
  currentCropRegion,
  onScoringDataScore,
  pageImages,
  showMultiplePages = true, // 常に複数ページ表示
  pageSpacing = 20,
  onTextInputStateChange,
  currentStudentId,
  currentUserId,
  questionScores,
}: AnswerIndividualViewProps) {
  // 画像ナビゲーション状態管理（内部管理）
  const { zoom, position, onZoomChange, onPositionChange } =
    useImageNavigation()

  // V4統合: 常にV4モードを使用
  const useV4Integration = true

  // 現在表示中の採点データを取得
  const currentScoringData =
    scoringDatas.find(
      (scoringData) => scoringData.id === currentScoringDataId,
    ) ?? null

  // 正しいQuestionScore.idを取得（studentIdとcropRegionIdで検索）
  const currentQuestionScoreId = useMemo(() => {
    if (!questionScores || !currentStudentId || !currentCropRegion?.id) {
      return null
    }
    const found = questionScores.find(
      (qs) =>
        qs.studentId === currentStudentId &&
        qs.cropRegionId === currentCropRegion.id,
    )
    return found?.id ?? null
  }, [questionScores, currentStudentId, currentCropRegion])

  // 描画状態管理（データベース統合対応）
  // questionScoresから正しいQuestionScore.idを取得して渡す
  // 見つからない場合はnullを渡し、context情報でバックエンドがQuestionScoreを自動作成する
  const drawingState = useDrawingState(
    currentQuestionScoreId,
    true, // データベース永続化を有効化
    {
      currentStudentId,
      currentCropRegionId: currentCropRegion?.id,
      currentUserId,
    },
  )

  // 透明度制御用：全設問のアノテーション読み込み
  const [allStudentAnnotations, setAllStudentAnnotations] = useState<
    DrawingAnnotation[]
  >([])

  // 現在の学生とプロジェクトの全アノテーションを読み込み（透明度制御用）
  useEffect(() => {
    const loadAllAnnotations = async () => {
      if (!currentStudentId || !currentCropRegion?.projectPage?.projectId) {
        setAllStudentAnnotations([])
        return
      }

      try {
        console.log("🎨 透明度制御: 全設問アノテーション読み込み開始", {
          studentId: currentStudentId,
          projectId: currentCropRegion.projectPage.projectId,
        })

        // ElectronAPIを直接呼び出してフック依存関係を回避
        const result = await window.electronAPI.drawing.getByStudent(
          currentStudentId,
          currentCropRegion.projectPage.projectId,
        )

        if (result.success && result.data) {
          console.log("🎨 透明度制御: 読み込み完了", {
            annotationCount: result.data.length,
            currentCropRegionId: currentCropRegion?.id,
          })
          setAllStudentAnnotations(result.data)
        } else {
          console.error("全設問アノテーション読み込みエラー:", result.error)
          setAllStudentAnnotations([])
        }
      } catch (error) {
        console.error("全設問アノテーション読み込みエラー:", error)
        setAllStudentAnnotations([])
      }
    }

    loadAllAnnotations()
  }, [
    currentStudentId,
    currentCropRegion?.projectPage?.projectId,
    currentCropRegion?.id,
  ])

  // テキスト入力状態変更の通知
  useEffect(() => {
    if (onTextInputStateChange) {
      onTextInputStateChange(drawingState.showTextInput)
    }
  }, [drawingState.showTextInput, onTextInputStateChange])

  // currentCropRegionはすでにpropsで渡されている（派生済み）

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

  // V4統合フック（画像サイズが確定してから初期化）
  const canvasWidth = loadedImages.length > 0 ? loadedImages[0].width : 800
  const canvasHeight = loadedImages.length > 0 ? loadedImages[0].height : 600

  // 画像アスペクト比（Shift制約で正円/正方形にするため）
  const imageAspectRatio = useMemo(() => {
    if (loadedImages.length > 0) {
      const img = loadedImages[0]
      return img.naturalWidth / img.naturalHeight
    }
    return 1
  }, [loadedImages])

  // 答案画像のURL取得
  const backgroundImageUrl = currentScoringData
    ? currentScoringData.imageUrl.replace("appimg://", "file://")
    : undefined

  const v4Integration = useTextboxV4Integration({
    canvasWidth,
    canvasHeight,
    drawingElements: drawingState.drawingElements,
    updateDrawingElements: drawingState.setDrawingElements,
    addDrawingElement: drawingState.addDrawingElement,
    updateDrawingElement: drawingState.updateDrawingElement,
  })

  // V4統合: テキストアンカークリック処理
  const handleTextAnchorClick = useCallback(
    (position: { x: number; y: number }) => {
      if (useV4Integration) {
        // V4統合モード: V4統合モーダルを開く
        v4Integration.openV4Modal(position)
      } else {
        // レガシーモード: 古いモーダルを開く（既存のロジック維持）
        // 注：この部分は将来的に削除予定
        console.warn(
          "レガシーテキストモードは非推奨です。V4統合モードをご利用ください。",
        )
      }
    },
    [useV4Integration, v4Integration],
  )

  // V4統合: テキスト要素の再編集処理
  const handleTextElementReClick = useCallback(
    (element: any) => {
      // V4統合モード: V4統合モーダルを開く
      v4Integration.openV4Modal(
        { x: element.x, y: element.y },
        element.text || "",
        element.id,
      )
      v4Integration.setCurrentTextColor(element.color || "#000000")
    },
    [v4Integration],
  )

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

    // 余白の比率: 2:6:2（左右/上下に20%ずつの余白、中央60%に設問を表示）
    const marginRatio = 0.2
    const contentRatio = 1 - marginRatio * 2 // 0.6
    const effectiveWidth = availableWidth * contentRatio
    const effectiveHeight = availableHeight * contentRatio

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

  // キーボードショートカット: 全体表示（個別モード専用）
  useCommand("view.fullView", handleMaximizeView, {
    when: "!inputFocus && !modalOpen && gradingMode == 'individual'",
    metadata: {
      title: "全体表示",
      category: "表示制御",
      description: "個別採点時にページ全体を表示します",
    },
  })

  // キーボードショートカット: 設問表示（個別モード専用）
  useCommand("view.questionView", handleCropView, {
    when: "!inputFocus && !modalOpen && gradingMode == 'individual'",
    metadata: {
      title: "設問表示",
      category: "表示制御",
      description: "個別採点時に設問領域をフィットして表示します",
    },
  })

  // ============================================
  // 描画ツールのキーボードショートカット
  // ============================================

  // ハンドツール
  useCommand(
    "tool.hand",
    useCallback(() => drawingState.setCurrentTool("hand"), [drawingState]),
    {
      when: "!inputFocus && !modalOpen && !textEditorActive && gradingMode == 'individual'",
      metadata: {
        title: "ハンドツール",
        category: "描画ツール",
        description: "画面のパン操作を行います",
      },
    },
  )

  // 選択ツール
  useCommand(
    "tool.select",
    useCallback(() => drawingState.setCurrentTool("select"), [drawingState]),
    {
      when: "!inputFocus && !modalOpen && !textEditorActive && gradingMode == 'individual'",
      metadata: {
        title: "選択ツール",
        category: "描画ツール",
        description: "図形を選択・移動・編集します",
      },
    },
  )

  // テキストツール
  useCommand(
    "tool.text",
    useCallback(() => drawingState.setCurrentTool("text"), [drawingState]),
    {
      when: "!inputFocus && !modalOpen && !textEditorActive && gradingMode == 'individual'",
      metadata: {
        title: "テキストツール",
        category: "描画ツール",
        description: "テキストを追加します",
      },
    },
  )

  // 線ツール
  useCommand(
    "tool.line",
    useCallback(() => drawingState.setCurrentTool("line"), [drawingState]),
    {
      when: "!inputFocus && !modalOpen && !textEditorActive && gradingMode == 'individual'",
      metadata: {
        title: "線ツール",
        category: "描画ツール",
        description: "直線を描画します",
      },
    },
  )

  // 矩形ツール
  useCommand(
    "tool.rectangle",
    useCallback(() => drawingState.setCurrentTool("rectangle"), [drawingState]),
    {
      when: "!inputFocus && !modalOpen && !textEditorActive && gradingMode == 'individual'",
      metadata: {
        title: "矩形ツール",
        category: "描画ツール",
        description: "矩形を描画します",
      },
    },
  )

  // 楕円ツール
  useCommand(
    "tool.ellipse",
    useCallback(() => drawingState.setCurrentTool("ellipse"), [drawingState]),
    {
      when: "!inputFocus && !modalOpen && !textEditorActive && gradingMode == 'individual'",
      metadata: {
        title: "楕円ツール",
        category: "描画ツール",
        description: "楕円・円を描画します",
      },
    },
  )

  // 設問変更時に選択設問を画面内で中央寄せ表示（ズームは維持）
  useEffect(() => {
    if (
      !currentCropRegion ||
      !containerRef.current ||
      !imageLoaded ||
      loadedImages.length === 0
    )
      return

    const container = containerRef.current

    // 設問が属するページの画像を使用
    const questionPageNumber = currentCropRegion.projectPage?.pageNumber || 1
    const questionPageIndex = questionPageNumber - 1

    const questionImg = loadedImages[questionPageIndex] || loadedImages[0]
    if (!questionImg) return

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

    // 画像の中央配置オフセットを考慮
    const canvasWidth = loadedImages[0].naturalWidth
    const imageOffsetX = (canvasWidth - questionImg.naturalWidth) / 2

    // 次のフレームでスクロール位置を調整
    requestAnimationFrame(() => {
      // 設問の実際のCanvas上での位置（ズーム適用後）
      const questionCenterScreenX = (questionCenterX + imageOffsetX) * zoom
      const questionCenterScreenY = (questionCenterY + pageOffsetY) * zoom

      // コンテナ中心座標
      const containerCenterX = container.offsetWidth / 2
      const containerCenterY = container.offsetHeight / 2

      // 理想的なスクロール位置（設問を中央に）
      const idealScrollLeft = questionCenterScreenX - containerCenterX
      const idealScrollTop = questionCenterScreenY - containerCenterY

      // はみ出さないように制限
      const maxScrollLeft = container.scrollWidth - container.offsetWidth
      const maxScrollTop = container.scrollHeight - container.offsetHeight
      const scrollLeft = Math.max(0, Math.min(idealScrollLeft, maxScrollLeft))
      const scrollTop = Math.max(0, Math.min(idealScrollTop, maxScrollTop))

      container.scrollTo({
        left: scrollLeft,
        top: scrollTop,
        behavior: "smooth",
      })
    })
  }, [
    currentCropRegion?.id,
    containerRef,
    imageLoaded,
    loadedImages,
    pageSpacing,
    zoom,
  ])

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
                      0,
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
                    0,
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
                        0,
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
                    0,
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
                        0,
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
                    0,
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
                        0,
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
        onLineStyleChange={(style) => drawingState.setLineStyle(style as any)}
        selectedElements={drawingState.drawingElements.filter((el) =>
          drawingState.selectedElementIds.includes(el.id),
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
        onLoad={(e) => {
          const img = e.target as HTMLImageElement
        }}
        onError={(e) => {
          console.error("🚫 Hidden img element failed to load:", e)
        }}
      />
    </div>
  )
}
