"use client"

import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import type { ScoringBehavior } from "@/components/projects/07-score-at-once/ScoringIndividual/ScoringBehaviorSelector"
import { ScoringContentArea } from "@/components/projects/07-score-at-once/ScoringMain/ScoringContentArea"
import { ScoringHeaderControls } from "@/components/projects/07-score-at-once/ScoringMain/ScoringHeaderControls"
import { ScoringModals } from "@/components/projects/07-score-at-once/ScoringMain/ScoringModals"
import {
  ScoringErrorState,
  ScoringLoadingState,
} from "@/components/projects/07-score-at-once/ScoringMain/ScoringStates"
import { ShortcutProvider } from "@/components/projects/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import { useBatchScoringWithProgress } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useBatchScoringWithProgress"
import { usePartialScore } from "@/components/projects/07-score-at-once/ScoringMain/hooks/usePartialScore"
import { useScoringData } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useScoringData"
import { useScoringDataLoader } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useScoringDataLoader"
import { useScoringFilter } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useScoringFilter"
import { useScoringMainState } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useScoringMainState"
import { useScoringNavigation } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useScoringNavigation"
import { useScoringSettings } from "@/components/projects/07-score-at-once/ScoringMain/hooks/useScoringSettings"
import { ScoringSidePanel } from "@/components/projects/07-score-at-once/ScoringSidePanel/ScoringSidePanel"
import { useCommand } from "@/components/projects/07-score-at-once/hooks/useCommand"
import { useContextValue } from "@/components/projects/07-score-at-once/hooks/useContextValue"
import Head from "next/head"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

// 内部コンポーネント（ShortcutProvider内で使用）
function ScoringMainViewContent() {
  const params = useParams()
  const projectId = params.projectId as string
  const { helpButton } = usePageHelp()

  // データローダーフック
  const {
    loading,
    project,
    pageImages,
    cropRegions,
    currentUserId,
    error: _error,
  } = useScoringDataLoader(projectId)

  // 設定管理フック
  const {
    itemsPerLine,
    autoScroll,
    showStudentNames,
    setItemsPerLine,
    setAutoScroll,
    setShowStudentNames,
  } = useScoringSettings()

  // 個別表示用の状態
  const [scoringBehavior, setScoringBehavior] =
    useState<ScoringBehavior>("next-student")

  // メイン状態管理
  const {
    // 個別の状態
    gradingMode,
    selectedPageImageIds,
    layoutDirection,
    currentStudentIndex,
    currentCropRegionId,
    showKeyboardHelp,
    showScoreComparison,
    showSidePanel,
    modifierKeyLabel,
    // アクション関数
    setGradingMode,
    setSelectedPageImageIds,
    setLayoutDirection,
    setCurrentStudentIndex,
    setCurrentCropRegionId,
    setShowKeyboardHelp,
    setShowScoreComparison,
    setShowSidePanel,
    setModifierKeyLabel,
    // ヘルパー関数
    handleAnswerSelect,
  } = useScoringMainState()

  // 個別表示モードに切り替え時、selectedPageImageIdsを単一選択に制限
  useEffect(() => {
    if (gradingMode === "individual" && selectedPageImageIds.size > 1) {
      // 複数選択されている場合は最初の1つだけを残す
      const firstSelected = Array.from(selectedPageImageIds)[0]
      setSelectedPageImageIds(new Set([firstSelected]))
    }
  }, [gradingMode, selectedPageImageIds, setSelectedPageImageIds])

  // 設問が未選択時の自動選択
  useEffect(() => {
    if (cropRegions.length > 0 && !currentCropRegionId) {
      // 設問タイプ'QUESTION_ANSWER'の最初の設問を自動選択
      const firstQuestionRegion = cropRegions.find(
        (region) => region.type === "QUESTION_ANSWER",
      )
      if (firstQuestionRegion) {
        setCurrentCropRegionId(firstQuestionRegion.id)
      }
    }
  }, [cropRegions, currentCropRegionId, setCurrentCropRegionId])

  // 現在の答案と設問
  const currentAnswerSheet = useMemo(() => {
    if (gradingMode === "individual" && selectedPageImageIds.size > 0) {
      // 個別表示モードでは選択された答案を使用
      const selectedAnswerId = Array.from(selectedPageImageIds)[0]
      return pageImages.find((sheet) => sheet.id === selectedAnswerId)
    }
    // 一覧表示モードでは従来通り
    return pageImages[currentStudentIndex]
  }, [gradingMode, selectedPageImageIds, pageImages, currentStudentIndex])

  const currentCropRegion = cropRegions.find(
    (r) => r.id === currentCropRegionId,
  )

  // 個別表示用の生徒データは後で定義（allScoringDataが必要なため）

  // 個別表示用のナビゲーション関数
  const handleStudentChange = useCallback(
    (studentId: string) => {
      // 該当する生徒の答案を選択状態にする
      const studentSheets = pageImages.filter(
        (sheet: any) => sheet.student.id === studentId,
      )
      if (studentSheets.length > 0) {
        // 個別表示では単一選択なので、最初の答案のみを選択
        setSelectedPageImageIds(new Set([studentSheets[0].id]))

        // currentStudentIndex も更新
        const studentIndex = pageImages.findIndex(
          (sheet: any) => sheet.student.id === studentId,
        )
        if (studentIndex !== -1) {
          setCurrentStudentIndex(studentIndex)
        }
      }
    },
    [pageImages, setSelectedPageImageIds, setCurrentStudentIndex],
  )

  // Individual navigation callbacks and effects will be defined after students is available

  // 採点データ管理hook
  const {
    questionScores,
    setQuestionScores,
    loadQuestionScores,
    handleBatchScore,
    calculateQuestionProgress,
  } = useScoringData({
    currentUserId,
    setCurrentUserId: () => {}, // データローダーで管理するため空関数
    currentCropRegionId,
    pageImages,
    cropRegions,
  })

  // フィルタリング管理hook
  const {
    // 新しいデータ構造
    allScoringData,
    masterAnswerData,
    filteredScoringDataIds,
    selectedScoringDataIds,

    // 従来の互換性維持
    filterSettings,
    visibleAnswers,
    setRecentlyScoredAnswers,
    getGridAnswerData,
    handleRefreshFilter,
    handleToggleFilter,
    handleToggleFilterByScoreKey,
  } = useScoringFilter({
    pageImages,
    cropRegions,
    currentCropRegionId: currentCropRegionId,
    questionScores,
    selectedPageImageIds: selectedPageImageIds,
    setSelectedPageImageIds: setSelectedPageImageIds,
    project,
  })

  // 個別表示用の生徒データ（pageImagesから抽出、useMemoで安定化）
  const students = useMemo(() => {
    if (!pageImages || pageImages.length === 0) return []

    // pageImagesから重複を除いた生徒データを抽出
    const uniqueStudents = new Map()

    pageImages.forEach((sheet, index) => {
      if (sheet.student && !uniqueStudents.has(sheet.student.id)) {
        const studentData = {
          id: sheet.student.id,
          studentId: sheet.student.studentId,
          lastName: sheet.student.lastName,
          firstName: sheet.student.firstName,
          customOrder: sheet.student.projectStudents?.[0]?.customOrder || 0,
        }
        uniqueStudents.set(sheet.student.id, studentData)
      }
    })

    // customOrderでソートして配列に変換
    const sortedStudents = Array.from(uniqueStudents.values()).sort(
      (a, b) => a.customOrder - b.customOrder,
    )
    return sortedStudents
  }, [pageImages])

  // 個別表示モードで最初の生徒を自動選択
  useEffect(() => {
    if (
      gradingMode === "individual" &&
      students.length > 0 &&
      selectedPageImageIds.size === 0
    ) {
      const sortedStudents = [...students].sort(
        (a, b) => a.customOrder - b.customOrder,
      )
      handleStudentChange(sortedStudents[0].id)
    }
  }, [gradingMode, students, selectedPageImageIds.size, handleStudentChange])

  const handleIndividualNextStudent = useCallback(() => {
    if (selectedPageImageIds.size === 0) return

    const currentAnswerId = Array.from(selectedPageImageIds)[0]
    const currentAnswer = pageImages.find((a: any) => a.id === currentAnswerId)
    if (!currentAnswer) return

    const sortedStudents = [...students].sort(
      (a, b) => a.customOrder - b.customOrder,
    )
    const currentIndex = sortedStudents.findIndex(
      (s) => s.id === currentAnswer.student?.id,
    )
    if (currentIndex < sortedStudents.length - 1) {
      const nextStudent = sortedStudents[currentIndex + 1]
      const nextStudentAnswer = pageImages.find(
        (a: any) => a.student?.id === nextStudent.id,
      )
      if (nextStudentAnswer) {
        setSelectedPageImageIds(new Set([nextStudentAnswer.id]))
      }
    }
  }, [students, selectedPageImageIds, pageImages, setSelectedPageImageIds])

  const handleIndividualPrevStudent = useCallback(() => {
    if (selectedPageImageIds.size === 0) return

    const currentAnswerId = Array.from(selectedPageImageIds)[0]
    const currentAnswer = pageImages.find((a: any) => a.id === currentAnswerId)
    if (!currentAnswer) return

    const sortedStudents = [...students].sort(
      (a, b) => a.customOrder - b.customOrder,
    )
    const currentIndex = sortedStudents.findIndex(
      (s) => s.id === currentAnswer.student?.id,
    )
    if (currentIndex > 0) {
      const prevStudent = sortedStudents[currentIndex - 1]
      const prevStudentAnswer = pageImages.find(
        (a: any) => a.student?.id === prevStudent.id,
      )
      if (prevStudentAnswer) {
        setSelectedPageImageIds(new Set([prevStudentAnswer.id]))
      }
    }
  }, [students, selectedPageImageIds, pageImages, setSelectedPageImageIds])

  // ナビゲーション管理hook
  const {
    viewMode,
    setViewMode,
    handleNextQuestion,
    handlePrevQuestion,
    handleNextStudent,
    handlePrevStudent,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    toggleViewMode,
    handleGridNavigation,
  } = useScoringNavigation({
    answerSheetsLength: pageImages.length,
    cropRegionsLength: cropRegions.length,
    currentStudentIndex: currentStudentIndex,
    setCurrentStudentIndex: setCurrentStudentIndex,
    currentCropRegionId: currentCropRegionId,
    setCurrentCropRegionId: setCurrentCropRegionId,
    selectedPageImageIds: selectedPageImageIds,
    setSelectedPageImageIds: setSelectedPageImageIds,
    layoutDirection: layoutDirection,
    getGridAnswerData,
    effectiveColumns: itemsPerLine[0],
    cropRegions: cropRegions,
  })

  // バッチ採点と自動進行
  const { handleBatchScoreWithProgress, handleAutoAdvance } =
    useBatchScoringWithProgress({
      selectedAnswers: selectedPageImageIds,
      gradingMode: gradingMode,
      setRecentlyScoredAnswers,
      handleBatchScore,
      getGridAnswerData,
      setSelectedAnswers: setSelectedPageImageIds,
      handleGridNavigation,
      handleNextStudent,
    })

  // 生徒名表示設定の変更
  const handleToggleStudentNames = useCallback(() => {
    setShowStudentNames(!showStudentNames)
  }, [showStudentNames, setShowStudentNames])

  // 部分点入力管理hook
  const {
    partialScoreInput,
    showPartialScoreModal,
    setPartialScoreInput,
    setShowPartialScoreModal,
    handlePartialScoreInput,
    handlePartialScoreConfirm,
    handlePartialScoreCancel,
    handlePartialScoreBackspace,
    handlePartialScoreChange,
  } = usePartialScore({
    selectedAnswers: selectedPageImageIds,
    currentCropRegion,
    onBatchScore: handleBatchScoreWithProgress, // 自動進行機能付きに変更
    onAutoAdvance: handleAutoAdvance,
  })

  // ============================================
  // 新しいショートカットシステム: コンテキスト値の設定
  // ============================================
  useContextValue("gradingMode", gradingMode)
  useContextValue("hasSelectedAnswers", selectedPageImageIds.size > 0)
  useContextValue("sidePanelVisible", showSidePanel)
  useContextValue("partialScoreModalOpen", showPartialScoreModal)
  useContextValue("modalOpen", showPartialScoreModal || showScoreComparison)
  // inputFocus は ShortcutProvider が自動検出
  // textEditorActive は RichTextEditor で設定

  // ============================================
  // 新しいショートカットシステム: コマンド登録（動作確認用）
  // ============================================

  // 生徒名表示切り替えコマンド
  useCommand("view.toggleStudentNames", handleToggleStudentNames, {
    when: "!inputFocus && !modalOpen",
    metadata: {
      title: "生徒名表示切り替え",
      category: "表示",
      description: "グリッド内の生徒名表示を切り替えます",
    },
  })

  // フィルタ更新コマンド
  useCommand("filter.refresh", handleRefreshFilter, {
    when: "!inputFocus && !modalOpen",
    metadata: {
      title: "フィルタ更新",
      category: "フィルタ",
      description: "フィルタ条件を適用して表示を更新します",
    },
  })

  // ============================================
  // ナビゲーションコマンドの登録
  // ============================================

  // 矢印キー: 問題切り替え
  useCommand("navigation.nextQuestionArrow", handleNextQuestion, {
    when: "!inputFocus && !modalOpen",
    metadata: {
      title: "次の問題へ（→）",
      category: "ナビゲーション",
    },
  })

  useCommand("navigation.prevQuestionArrow", handlePrevQuestion, {
    when: "!inputFocus && !modalOpen",
    metadata: {
      title: "前の問題へ（←）",
      category: "ナビゲーション",
    },
  })

  // Shift+A/D: 問題切り替え
  useCommand("navigation.nextQuestion", handleNextQuestion, {
    when: "!inputFocus && !modalOpen",
    metadata: {
      title: "次の問題へ（Shift+D）",
      category: "ナビゲーション",
    },
  })

  useCommand("navigation.prevQuestion", handlePrevQuestion, {
    when: "!inputFocus && !modalOpen",
    metadata: {
      title: "前の問題へ（Shift+A）",
      category: "ナビゲーション",
    },
  })

  // 矢印キー: 生徒切り替え（グリッドモードでは使用しない）
  // WASDがグリッド移動に使われるため、矢印キーの上下は使用しない

  // WASD: グリッド移動（グリッドモードのみ）
  useCommand("navigation.moveUp", () => handleGridNavigation("w"), {
    when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
    metadata: {
      title: "上に移動",
      category: "ナビゲーション",
    },
  })

  useCommand("navigation.moveDown", () => handleGridNavigation("s"), {
    when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
    metadata: {
      title: "下に移動",
      category: "ナビゲーション",
    },
  })

  useCommand("navigation.moveLeft", () => handleGridNavigation("a"), {
    when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
    metadata: {
      title: "左に移動",
      category: "ナビゲーション",
    },
  })

  useCommand("navigation.moveRight", () => handleGridNavigation("d"), {
    when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
    metadata: {
      title: "右に移動",
      category: "ナビゲーション",
    },
  })

  // ズーム操作
  useCommand("navigation.zoomIn", handleZoomIn, {
    when: "!inputFocus && !modalOpen",
    metadata: {
      title: "ズームイン",
      category: "ナビゲーション",
    },
  })

  useCommand("navigation.zoomOut", handleZoomOut, {
    when: "!inputFocus && !modalOpen",
    metadata: {
      title: "ズームアウト",
      category: "ナビゲーション",
    },
  })

  useCommand("navigation.resetZoom", handleResetZoom, {
    when: "!inputFocus && !modalOpen",
    metadata: {
      title: "ズームリセット",
      category: "ナビゲーション",
    },
  })

  // ============================================
  // Ctrl+数字フィルタコマンド（グリッドモードのみ）
  // ============================================
  useCommand("filter.toggle1", () => handleToggleFilter("1"), {
    when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
    metadata: {
      title: "フィルタ1切り替え",
      category: "フィルタ",
    },
  })

  useCommand("filter.toggle2", () => handleToggleFilter("2"), {
    when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
    metadata: {
      title: "フィルタ2切り替え",
      category: "フィルタ",
    },
  })

  useCommand("filter.toggle3", () => handleToggleFilter("3"), {
    when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
    metadata: {
      title: "フィルタ3切り替え",
      category: "フィルタ",
    },
  })

  useCommand("filter.toggle4", () => handleToggleFilter("4"), {
    when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
    metadata: {
      title: "フィルタ4切り替え",
      category: "フィルタ",
    },
  })

  useCommand("filter.toggle5", () => handleToggleFilter("5"), {
    when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
    metadata: {
      title: "フィルタ5切り替え",
      category: "フィルタ",
    },
  })

  useCommand("filter.toggle6", () => handleToggleFilter("6"), {
    when: "!inputFocus && !modalOpen && gradingMode == 'grid'",
    metadata: {
      title: "フィルタ6切り替え",
      category: "フィルタ",
    },
  })

  // ============================================
  // 部分点モーダルコマンド
  // ============================================
  useCommand(
    "modal.confirmPartial",
    () => handlePartialScoreConfirm("partial"),
    {
      when: "partialScoreModalOpen",
      metadata: {
        title: "部分点として確定",
        category: "モーダル",
        description: "入力した部分点を確定します",
      },
    },
  )

  useCommand(
    "modal.confirmPending",
    () => handlePartialScoreConfirm("pending"),
    {
      when: "partialScoreModalOpen",
      metadata: {
        title: "保留として確定",
        category: "モーダル",
        description: "保留として確定します",
      },
    },
  )

  useCommand("modal.cancel", handlePartialScoreCancel, {
    when: "modalOpen",
    metadata: {
      title: "モーダルを閉じる",
      category: "モーダル",
    },
  })

  useCommand("modal.backspace", handlePartialScoreBackspace, {
    when: "partialScoreModalOpen",
    metadata: {
      title: "文字削除",
      category: "モーダル",
    },
  })

  // 数字入力コマンド（0-9と小数点）
  useCommand("modal.input0", () => handlePartialScoreInput("0"), {
    when: "partialScoreModalOpen",
    metadata: { title: "0を入力", category: "モーダル" },
  })

  useCommand("modal.input1", () => handlePartialScoreInput("1"), {
    when: "partialScoreModalOpen",
    metadata: { title: "1を入力", category: "モーダル" },
  })

  useCommand("modal.input2", () => handlePartialScoreInput("2"), {
    when: "partialScoreModalOpen",
    metadata: { title: "2を入力", category: "モーダル" },
  })

  useCommand("modal.input3", () => handlePartialScoreInput("3"), {
    when: "partialScoreModalOpen",
    metadata: { title: "3を入力", category: "モーダル" },
  })

  useCommand("modal.input4", () => handlePartialScoreInput("4"), {
    when: "partialScoreModalOpen",
    metadata: { title: "4を入力", category: "モーダル" },
  })

  useCommand("modal.input5", () => handlePartialScoreInput("5"), {
    when: "partialScoreModalOpen",
    metadata: { title: "5を入力", category: "モーダル" },
  })

  useCommand("modal.input6", () => handlePartialScoreInput("6"), {
    when: "partialScoreModalOpen",
    metadata: { title: "6を入力", category: "モーダル" },
  })

  useCommand("modal.input7", () => handlePartialScoreInput("7"), {
    when: "partialScoreModalOpen",
    metadata: { title: "7を入力", category: "モーダル" },
  })

  useCommand("modal.input8", () => handlePartialScoreInput("8"), {
    when: "partialScoreModalOpen",
    metadata: { title: "8を入力", category: "モーダル" },
  })

  useCommand("modal.input9", () => handlePartialScoreInput("9"), {
    when: "partialScoreModalOpen",
    metadata: { title: "9を入力", category: "モーダル" },
  })

  useCommand("modal.inputDot", () => handlePartialScoreInput("."), {
    when: "partialScoreModalOpen",
    metadata: { title: "小数点を入力", category: "モーダル" },
  })

  // ============================================
  // 部分点モーダルオープンコマンド（数字キー）
  // ============================================
  // モーダルが閉じている状態で数字キーを押すと、モーダルを開いてその数字を入力
  useCommand("scoring.openPartialWith0", () => handlePartialScoreInput("0"), {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers && gradingMode == 'grid'",
    metadata: { title: "0キーで部分点入力", category: "採点" },
  })

  useCommand("scoring.openPartialWith1", () => handlePartialScoreInput("1"), {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers && gradingMode == 'grid'",
    metadata: { title: "1キーで部分点入力", category: "採点" },
  })

  useCommand("scoring.openPartialWith2", () => handlePartialScoreInput("2"), {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers && gradingMode == 'grid'",
    metadata: { title: "2キーで部分点入力", category: "採点" },
  })

  useCommand("scoring.openPartialWith3", () => handlePartialScoreInput("3"), {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers && gradingMode == 'grid'",
    metadata: { title: "3キーで部分点入力", category: "採点" },
  })

  useCommand("scoring.openPartialWith4", () => handlePartialScoreInput("4"), {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers && gradingMode == 'grid'",
    metadata: { title: "4キーで部分点入力", category: "採点" },
  })

  useCommand("scoring.openPartialWith5", () => handlePartialScoreInput("5"), {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers && gradingMode == 'grid'",
    metadata: { title: "5キーで部分点入力", category: "採点" },
  })

  useCommand("scoring.openPartialWith6", () => handlePartialScoreInput("6"), {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers && gradingMode == 'grid'",
    metadata: { title: "6キーで部分点入力", category: "採点" },
  })

  useCommand("scoring.openPartialWith7", () => handlePartialScoreInput("7"), {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers && gradingMode == 'grid'",
    metadata: { title: "7キーで部分点入力", category: "採点" },
  })

  useCommand("scoring.openPartialWith8", () => handlePartialScoreInput("8"), {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers && gradingMode == 'grid'",
    metadata: { title: "8キーで部分点入力", category: "採点" },
  })

  useCommand("scoring.openPartialWith9", () => handlePartialScoreInput("9"), {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers && gradingMode == 'grid'",
    metadata: { title: "9キーで部分点入力", category: "採点" },
  })

  useCommand("scoring.openPartialWithDot", () => handlePartialScoreInput("."), {
    when: "!inputFocus && !modalOpen && hasSelectedAnswers && gradingMode == 'grid'",
    metadata: { title: ".キーで部分点入力", category: "採点" },
  })

  // selectedPageImageIdsから現在の生徒IDを取得
  const currentStudentId = useMemo(() => {
    if (selectedPageImageIds.size > 0) {
      const selectedAnswerId = Array.from(selectedPageImageIds)[0]
      const selectedAnswer = pageImages.find(
        (a: any) => a.id === selectedAnswerId,
      )
      return selectedAnswer?.student?.id || ""
    }
    return ""
  }, [selectedPageImageIds, pageImages])

  // スコア状態の変換関数（ScoreStatus → ScoringStatus）
  const convertScoreStatus = useCallback(
    (
      status:
        | "CORRECT"
        | "INCORRECT"
        | "PARTIAL"
        | "BLANK"
        | "PENDING"
        | "SKIP",
    ) => {
      const statusMap = {
        CORRECT: "correct",
        INCORRECT: "incorrect",
        PARTIAL: "partial",
        BLANK: "no_answer",
        PENDING: "pending",
        SKIP: "proposed",
      } as const
      return statusMap[status] as any
    },
    [],
  )

  // テキスト入力状態管理（キーボードショートカット制御用）
  const [showTextInput, setShowTextInput] = useState(false)

  // 採点データの初期化
  useEffect(() => {
    const initializeGradingData = async () => {
      if (!loading && project) {
        try {
          // 既存の採点データを読み込み
          const existingScores = await loadQuestionScores(projectId)
          setQuestionScores(existingScores)
        } catch (error) {
          console.error("Failed to initialize grading data:", error)
        }
      }
    }

    initializeGradingData()
  }, [projectId, loading, project, loadQuestionScores, setQuestionScores])

  // 設定変更ハンドラー
  const handleItemsPerLineChange = (value: number[]) => {
    setItemsPerLine(value)
  }

  const handleAutoScrollChange = (enabled: boolean) => {
    setAutoScroll(enabled)
  }

  // 設問別進捗を計算
  const questionProgress = calculateQuestionProgress()

  // ローディング状態
  if (loading) {
    return <ScoringLoadingState />
  }

  // エラー状態
  if (!project || pageImages.length === 0 || cropRegions.length === 0) {
    return (
      <ScoringErrorState
        project={project}
        answerSheetsLength={pageImages.length}
        cropRegionsLength={cropRegions.length}
        projectId={projectId}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Head>
        <title>{`採点 - ${project.examName}`}</title>
      </Head>

      {/* PageHeader */}
      <PageHeader title="一括採点" helpButton={helpButton}>
        <ScoringHeaderControls
          gradingMode={gradingMode}
          onGradingModeChange={setGradingMode}
          showKeyboardHelp={showKeyboardHelp}
          onShowKeyboardHelpChange={setShowKeyboardHelp}
          showSidePanel={showSidePanel}
          onShowSidePanelChange={setShowSidePanel}
          modifierKeyLabel={modifierKeyLabel}
          helpButton={helpButton}
        />
      </PageHeader>

      {/* 採点エリア - Grid Layout */}
      <div
        className="grid h-full min-h-0 flex-1"
        style={{
          gridTemplateColumns: showSidePanel ? "1fr 24rem" : "1fr",
          gridTemplateRows: "1fr",
        }}
      >
        <ScoringContentArea
          gradingMode={gradingMode}
          allScoringData={allScoringData}
          masterAnswerData={masterAnswerData}
          filteredScoringDataIds={filteredScoringDataIds}
          selectedScoringDataIds={selectedScoringDataIds}
          currentCropRegion={currentCropRegion}
          pageImages={pageImages}
          onScoringDataSelect={(dataId, isSelected) =>
            handleAnswerSelect(dataId, isSelected, pageImages)
          }
          onScoringDataScore={handleBatchScoreWithProgress}
          layoutDirection={layoutDirection}
          itemsPerLine={itemsPerLine}
          autoScroll={autoScroll}
          showStudentNames={showStudentNames}
          onTextInputStateChange={setShowTextInput}
          currentStudentId={currentStudentId || undefined}
          currentUserId={currentUserId || undefined}
        />

        {/* 右側サイドパネル */}
        {showSidePanel && (
          <ScoringSidePanel
            projectId={projectId}
            cropRegions={cropRegions}
            currentCropRegion={currentCropRegion}
            onCropRegionChange={(cropRegion) => {
              setCurrentCropRegionId(cropRegion?.id || null)
            }}
            onPrevQuestion={handlePrevQuestion}
            onNextQuestion={handleNextQuestion}
            questionProgress={questionProgress}
            selectedPageImageIds={selectedPageImageIds}
            selectedAnswersCount={selectedPageImageIds.size}
            filterSettings={filterSettings}
            onScore={handleBatchScoreWithProgress}
            onToggleFilter={handleToggleFilter}
            onRefreshFilter={handleRefreshFilter}
            partialScoreInput={partialScoreInput}
            modifierKeyLabel={modifierKeyLabel}
            layoutDirection={layoutDirection}
            visibleAnswersCount={visibleAnswers.length}
            totalAnswersCount={pageImages.length}
            onLayoutDirectionChange={setLayoutDirection}
            onGridNavigation={handleGridNavigation}
            onRefreshView={handleRefreshFilter}
            itemsPerLine={itemsPerLine}
            onItemsPerLineChange={handleItemsPerLineChange}
            autoScroll={autoScroll}
            onAutoScrollChange={handleAutoScrollChange}
            gradingMode={gradingMode}
            students={students}
            onStudentChange={handleStudentChange}
            pageImages={pageImages}
            scoringBehavior={scoringBehavior}
            onScoringBehaviorChange={(behavior) => setScoringBehavior(behavior)}
          />
        )}
      </div>

      {/* モーダル類 */}
      <ScoringModals
        showPartialScoreModal={showPartialScoreModal}
        partialScoreInput={partialScoreInput}
        currentCropRegion={currentCropRegion}
        onPartialScoreClose={handlePartialScoreCancel}
        onPartialScoreChange={handlePartialScoreChange}
        showScoreComparison={showScoreComparison}
        onScoreComparisonClose={() => setShowScoreComparison(false)}
        currentAnswerSheet={currentAnswerSheet}
      />
    </div>
  )
}

// メインのエクスポートコンポーネント
export default function ScoringMainView() {
  return (
    <ShortcutProvider>
      <ScoringMainViewContent />
    </ShortcutProvider>
  )
}
