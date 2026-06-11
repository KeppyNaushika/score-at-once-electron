"use client"

import Head from "next/head"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

import { useContextValue } from "@/components/exams/07-score-at-once/hooks/useContextValue"
import { OMRAutoScoringModal } from "@/components/exams/07-score-at-once/OMRRecognition/OMRAutoScoringModal"
import type { ScoringBehavior } from "@/components/exams/07-score-at-once/ScoringIndividual/ScoringBehaviorSelector"
import {
  ShortcutProvider,
  useShortcutContext,
} from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import { useBatchScoringWithProgress } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useBatchScoringWithProgress"
import { usePartialScore } from "@/components/exams/07-score-at-once/ScoringMain/hooks/usePartialScore"
import { useScoringActions } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringActions"
import { useScoringData } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringData"
import { useScoringDataLoader } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringDataLoader"
import { useScoringEffects } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringEffects"
import { useScoringFilter } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringFilter"
import { useScoringMainState } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringMainState"
import { useScoringMode } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringMode"
import { useScoringNavigation } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringNavigation"
import { useScoringSettings } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringSettings"
import { useScoringShortcuts } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringShortcuts"
import { useStudentAnswerManagement } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useStudentAnswerManagement"
import { ScoringContentArea } from "@/components/exams/07-score-at-once/ScoringMain/ScoringContentArea"
import { ScoringHeaderControls } from "@/components/exams/07-score-at-once/ScoringMain/ScoringHeaderControls"
import { ScoringModals } from "@/components/exams/07-score-at-once/ScoringMain/ScoringModals"
import { ScoringModeModal } from "@/components/exams/07-score-at-once/ScoringMain/ScoringModeModal"
import {
  ScoringErrorState,
  ScoringLoadingState,
} from "@/components/exams/07-score-at-once/ScoringMain/ScoringStates"
import { ScoringSidePanel } from "@/components/exams/07-score-at-once/ScoringSidePanel/ScoringSidePanel"
import type {
  MouseBrushAction,
  ScoringStatus,
} from "@/components/exams/07-score-at-once/types"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { useAuth } from "@/contexts/AuthContext"

/** 内部コンポーネント（ShortcutProvider内で使用） */
function ScoringMainViewContent() {
  const params = useParams()
  const examId = params.examId as string
  const { user: authUser } = useAuth()
  const { helpButton } = usePageHelp()
  const { keyBindings } = useShortcutContext()

  /** 操作モード管理 */
  const {
    scoringOperationMode,
    showModeSelectionModal,
    selectMode,
    setScoringOperationMode,
    closeModeSelectionModal,
    mouseBrush,
    setMouseBrush,
  } = useScoringMode()
  const effectiveMode = scoringOperationMode ?? "keyboard"

  /** モーダル用のキーバインディング */
  const modalKeyBindings = useMemo(
    () => ({
      partialKey: keyBindings["scoring.partial"],
      pendingKey: keyBindings["scoring.pending"],
      cancelKey: keyBindings["modal.cancel"],
    }),
    [keyBindings]
  )

  /** データローダーフック */
  const { loading, exam, studentAnswerImages, cropRegions, currentUserId } =
    useScoringDataLoader(examId, authUser?.id ?? null)

  /** 設定管理フック */
  const {
    itemsPerLine,
    autoScroll,
    showStudentNames,
    layoutDirection,
    expandMargin,
    clickScoringConfig,
    clickScoringDebounceMs,
    masterAnswerDisplayMode,
    masterAnswerOpacity,
    masterAnswerKeyBehavior,
    setItemsPerLine,
    setAutoScroll,
    setShowStudentNames,
    setLayoutDirection,
    setExpandMargin,
    setClickAction,
    setClickScoringDebounceMs,
    setMasterAnswerDisplayMode,
    setMasterAnswerOpacity,
    setMasterAnswerKeyBehavior,
  } = useScoringSettings()

  /** 模範解答表示状態（toggle/hold-to-show制御） */
  const [masterAnswerVisible, setMasterAnswerVisible] = useState(false)

  const [questionChangeVersion, setQuestionChangeVersion] = useState(0)

  /** アノテーション双方向連携用バージョンカウンター */
  const [annotationVersionForBrowser, setAnnotationVersionForBrowser] =
    useState(0)
  const [annotationVersionForCanvas, setAnnotationVersionForCanvas] =
    useState(0)
  const [annotationVersionForGrid, setAnnotationVersionForGrid] = useState(0)

  // キャンバスでアノテーション変更 → ブラウザパネル一覧 + Grid一覧をリロード
  const handleCanvasAnnotationChanged = useCallback(() => {
    setAnnotationVersionForBrowser((v) => v + 1)
    setAnnotationVersionForGrid((v) => v + 1)
  }, [])

  // ブラウザの+ボタンでアノテーション追加 → キャンバスプレビュー + Grid一覧をリロード
  const handleBrowserAnnotationAdded = useCallback(() => {
    setAnnotationVersionForCanvas((v) => v + 1)
    setAnnotationVersionForGrid((v) => v + 1)
  }, [])

  /** OMR自動採点モーダル */
  const [showOmrModal, setShowOmrModal] = useState(false)

  /** 個別表示用の状態 */
  const [scoringBehavior, setScoringBehavior] =
    useState<ScoringBehavior>("next-student")

  /** メイン状態管理 */
  const {
    /** 個別の状態 */
    gradingMode,
    selectedStudentAnswerImageIds,
    currentStudentIndex,
    currentCropRegionId,
    showKeyboardHelp,
    showScoreComparison,
    showSidePanel,
    modifierKeyLabel,
    /** アクション関数 */
    setGradingMode,
    setSelectedPageImageIds,
    setCurrentStudentIndex,
    setCurrentCropRegionId,
    setShowKeyboardHelp,
    setShowScoreComparison,
    setShowSidePanel,
    /** ヘルパー関数 */
    handleAnswerSelect,
    replaceSelection,
    manualSelectionVersion,
  } = useScoringMainState()

  /** 現在の答案と設問 */
  const currentAnswerSheet = useMemo(() => {
    if (
      gradingMode === "individual" &&
      selectedStudentAnswerImageIds.size > 0
    ) {
      const selectedAnswerId = Array.from(selectedStudentAnswerImageIds)[0]
      return studentAnswerImages.find((sheet) => sheet.id === selectedAnswerId)
    }
    return studentAnswerImages[currentStudentIndex]
  }, [
    gradingMode,
    selectedStudentAnswerImageIds,
    studentAnswerImages,
    currentStudentIndex,
  ])

  const currentCropRegion = cropRegions.find(
    (r) => r.id === currentCropRegionId
  )

  /** Effect処理フック */
  useScoringEffects({
    gradingMode,
    selectedStudentAnswerImageIds,
    studentAnswerImages,
    cropRegions,
    currentCropRegionId,
    setSelectedPageImageIds,
    setCurrentCropRegionId,
    setQuestionChangeVersion,
  })

  /** 生徒・答案管理フック */
  const {
    students,
    handleStudentChange,
    handleIndividualNextStudent,
    handleIndividualPrevStudent,
  } = useStudentAnswerManagement({
    studentAnswerImages,
    selectedStudentAnswerImageIds,
    gradingMode,
    currentCropRegion,
    setSelectedPageImageIds,
    setCurrentStudentIndex,
  })

  /** 採点データ管理hook */
  const {
    questionScores,
    setQuestionScores,
    loadQuestionScores,
    handleBatchScore,
    calculateQuestionProgress,
  } = useScoringData({
    currentUserId,
    setCurrentUserId: () => {},
    currentCropRegionId,
    studentAnswerImages,
    cropRegions,
  })

  /** QuestionScore作成後のリロードコールバック */
  const handleQuestionScoreCreated = useCallback(async () => {
    const scores = await loadQuestionScores(examId)
    setQuestionScores(scores)
  }, [loadQuestionScores, examId, setQuestionScores])

  /** フィルタリング管理hook */
  const {
    /** 新しいデータ構造 */
    allScoringData,
    masterAnswerData,
    filteredScoringDataIds,
    selectedScoringDataIds,

    /** 従来の互換性維持 */
    filterSettings,
    visibleAnswers,
    setRecentlyScoredAnswers,
    getGridAnswerData,
    handleRefreshFilter,
    handleToggleFilter,
  } = useScoringFilter({
    studentAnswerImages,
    cropRegions,
    currentCropRegionId: currentCropRegionId,
    questionScores,
    selectedStudentAnswerImageIds: selectedStudentAnswerImageIds,
    setSelectedPageImageIds: setSelectedPageImageIds,
    exam,
    gradingMode,
    questionChangeVersion,
    manualSelectionVersion,
  })

  const handleReplaceSelection = useCallback(
    (ids: string[]) => {
      replaceSelection(ids)
    },
    [replaceSelection]
  )

  /** 全選択：表示中（フィルタ適用後）の答案をすべて選択 */
  const handleSelectAll = useCallback(() => {
    replaceSelection(filteredScoringDataIds)
  }, [replaceSelection, filteredScoringDataIds])

  /** 未採点の生徒を全て選択（フィルターで非表示なら強制表示） */
  const handleSelectUnscored = useCallback(() => {
    // 未採点フィルターが無効なら有効にする
    if (!filterSettings.unscored) {
      handleToggleFilter("unscored")
    }
    // 次のレンダー後に選択するためqueueMicrotaskで遅延
    queueMicrotask(() => {
      const unscoredIds = allScoringData
        .filter((d) => d.status === "unscored")
        .map((d) => d.id)
      replaceSelection(unscoredIds)
    })
  }, [allScoringData, replaceSelection, filterSettings, handleToggleFilter])

  const { handleNextQuestion, handlePrevQuestion, handleGridNavigation } =
    useScoringNavigation({
      answerSheetsLength: studentAnswerImages.length,
      currentCropRegionId: currentCropRegionId,
      setCurrentCropRegionId: setCurrentCropRegionId,
      selectedStudentAnswerImageIds: selectedStudentAnswerImageIds,
      setSelectedPageImageIds: setSelectedPageImageIds,
      layoutDirection: layoutDirection,
      getGridAnswerData,
      effectiveColumns: itemsPerLine[0],
      cropRegions: cropRegions,
    })

  /** 1行あたりの表示件数を増減（ショートカットキー =/-） */
  const handleZoomIn = useCallback(() => {
    const next = Math.min(itemsPerLine[0] + 1, 10)
    setItemsPerLine([next])
  }, [itemsPerLine, setItemsPerLine])

  const handleZoomOut = useCallback(() => {
    const next = Math.max(itemsPerLine[0] - 1, 1)
    setItemsPerLine([next])
  }, [itemsPerLine, setItemsPerLine])

  const handleResetZoom = useCallback(() => {
    setItemsPerLine([5])
  }, [setItemsPerLine])

  /**
   * 個別モード用ナビゲーション
   * レイアウト方向に応じてWASD/矢印キーを次/前の生徒に変換
   */
  const handleIndividualNavigation = useCallback(
    (key: string) => {
      // レイアウト方向ごとに「次の生徒」方向のキーを判定
      let isNext = false
      let isPrev = false

      switch (layoutDirection) {
        case "right-down":
          // 右→下: d/s/ArrowDown = next, a/w/ArrowUp = prev
          isNext = key === "d" || key === "s" || key === "ArrowDown"
          isPrev = key === "a" || key === "w" || key === "ArrowUp"
          break
        case "left-down":
          // 左→下: a/s/ArrowDown = next, d/w/ArrowUp = prev
          isNext = key === "a" || key === "s" || key === "ArrowDown"
          isPrev = key === "d" || key === "w" || key === "ArrowUp"
          break
        case "down-right":
          // 下→右: s/d/ArrowDown = next, w/a/ArrowUp = prev
          isNext = key === "s" || key === "d" || key === "ArrowDown"
          isPrev = key === "w" || key === "a" || key === "ArrowUp"
          break
        case "down-left":
          // 下→左: s/a/ArrowDown = next, w/d/ArrowUp = prev
          isNext = key === "s" || key === "a" || key === "ArrowDown"
          isPrev = key === "w" || key === "d" || key === "ArrowUp"
          break
      }

      if (isNext) {
        handleIndividualNextStudent()
      } else if (isPrev) {
        handleIndividualPrevStudent()
      }
    },
    [layoutDirection, handleIndividualNextStudent, handleIndividualPrevStudent]
  )

  const { handleBatchScoreWithProgress } = useBatchScoringWithProgress({
    selectedAnswers: selectedStudentAnswerImageIds,
    gradingMode: gradingMode,
    scoringBehavior: scoringBehavior,
    setRecentlyScoredAnswers,
    handleBatchScore,
    getGridAnswerData,
    setSelectedAnswers: setSelectedPageImageIds,
    handleNextStudent: handleIndividualNextStudent,
    handleNextQuestion,
  })

  /** 採点アクションフック */
  const {
    handleToggleStudentNames,
    handleItemsPerLineChange,
    handleAutoScrollChange,
  } = useScoringActions({
    examId,
    loading,
    exam,
    loadQuestionScores,
    setQuestionScores,
    showStudentNames,
    setShowStudentNames,
    setItemsPerLine,
    setAutoScroll,
  })

  const {
    partialScoreInput,
    showPartialScoreModal,
    openPartialScoreModal,
    handlePartialScoreInput,
    handlePartialScoreConfirm,
    handlePartialScoreCancel,
    handlePartialScoreBackspace,
    handlePartialScoreChange,
  } = usePartialScore({
    selectedAnswers: selectedStudentAnswerImageIds,
    currentCropRegion,
    onBatchScore: handleBatchScoreWithProgress,
  })

  /** クリック採点：デバウンス後にクリック回数に応じたアクションを実行 */
  const handleClickScoring = useCallback(
    (answerId: string, clickCount: number) => {
      if (answerId.startsWith("master-")) return
      const action = clickScoringConfig[clickCount as 2 | 3 | 4] ?? "none"
      if (action === "none") return

      if (action === "individual") {
        replaceSelection([answerId])
        setGradingMode("individual")
        return
      }

      if (action === "partial_modal") {
        replaceSelection([answerId])
        openPartialScoreModal(new Set([answerId]))
        return
      }

      // 採点ステータスを直接適用
      const targetSet = new Set([answerId])
      handleBatchScore(action as ScoringStatus, null, null, targetSet)
      setRecentlyScoredAnswers((prev) => {
        const newSet = new Set(prev)
        newSet.add(answerId)
        return newSet
      })
    },
    [
      clickScoringConfig,
      replaceSelection,
      setGradingMode,
      openPartialScoreModal,
      handleBatchScore,
      setRecentlyScoredAnswers,
    ]
  )

  /** マウスモード: クリック採点（トグル付き） */
  const handleMouseScoring = useCallback(
    (answerId: string, status: MouseBrushAction, isToggle: boolean) => {
      if (answerId.startsWith("master-")) return

      // 「部分点入力」ブラシ: クリックした答案の部分点入力モーダルを開く
      // （ダブルクリックの「部分点入力」動作と同じ）
      if (status === "partial_modal") {
        replaceSelection([answerId])
        openPartialScoreModal(new Set([answerId]))
        return
      }

      // トグル: 同じステータスなら未採点に戻す
      if (isToggle) {
        const currentData = allScoringData.find((d) => d.id === answerId)
        if (currentData?.status === status) {
          const targetSet = new Set([answerId])
          handleBatchScore("unscored" as ScoringStatus, null, null, targetSet)
          setRecentlyScoredAnswers((prev) => {
            const newSet = new Set(prev)
            newSet.add(answerId)
            return newSet
          })
          return
        }
      }

      const targetSet = new Set([answerId])
      handleBatchScore(status as ScoringStatus, null, null, targetSet)
      setRecentlyScoredAnswers((prev) => {
        const newSet = new Set(prev)
        newSet.add(answerId)
        return newSet
      })
    },
    [
      allScoringData,
      handleBatchScore,
      setRecentlyScoredAnswers,
      replaceSelection,
      openPartialScoreModal,
    ]
  )

  /** マウスモード: 表示中の未採点を一括採点 */
  const handleBatchScoreVisibleUnscored = useCallback(
    (status: MouseBrushAction) => {
      const unscoredVisible = allScoringData.filter(
        (d) => d.status === "unscored" && filteredScoringDataIds.includes(d.id)
      )
      if (unscoredVisible.length === 0) return
      const targetSet = new Set(unscoredVisible.map((d) => d.id))
      handleBatchScore(status as ScoringStatus, null, null, targetSet)
      setRecentlyScoredAnswers((prev) => {
        const newSet = new Set(prev)
        unscoredVisible.forEach((d) => newSet.add(d.id))
        return newSet
      })
    },
    [
      allScoringData,
      filteredScoringDataIds,
      handleBatchScore,
      setRecentlyScoredAnswers,
    ]
  )

  /** 表示中の未採点件数 */
  const visibleUnscoredCount = useMemo(
    () =>
      allScoringData.filter(
        (d) => d.status === "unscored" && filteredScoringDataIds.includes(d.id)
      ).length,
    [allScoringData, filteredScoringDataIds]
  )

  /** 非表示の未採点件数 */
  const hiddenUnscoredCount = useMemo(
    () =>
      allScoringData.filter(
        (d) => d.status === "unscored" && !filteredScoringDataIds.includes(d.id)
      ).length,
    [allScoringData, filteredScoringDataIds]
  )

  /** 表示モード切り替え（グリッド⇔個別） */
  const handleToggleViewMode = useCallback(
    () => setGradingMode((prev) => (prev === "grid" ? "individual" : "grid")),
    [setGradingMode]
  )

  /** 模範解答表示トグル */
  const handleToggleMasterAnswer = useCallback(() => {
    if (masterAnswerDisplayMode === "off") return
    if (masterAnswerKeyBehavior === "toggle") {
      setMasterAnswerVisible((prev) => !prev)
    } else {
      // hold-to-show: keydownでon（keyupはネイティブイベントで処理）
      setMasterAnswerVisible(true)
    }
  }, [masterAnswerDisplayMode, masterAnswerKeyBehavior])

  /** 模範解答を直接表示/非表示（hold-to-show用） */
  const handleMasterAnswerShow = useCallback(() => {
    setMasterAnswerVisible(true)
  }, [])
  const handleMasterAnswerHide = useCallback(() => {
    setMasterAnswerVisible(false)
  }, [])

  /** 用紙サイズ（MasterImageのpageSizeフィールドから取得、デフォルトA4） */
  const pageSize = useMemo(() => {
    if (!exam?.examPages) return "A4"
    for (const page of exam.examPages) {
      const masterImage = page.masterImages?.[0]
      if (masterImage?.pageSize) {
        console.log(`[pageSize] MasterImageから取得: "${masterImage.pageSize}"`)
        return masterImage.pageSize
      }
    }
    console.log("[pageSize] デフォルト: A4")
    return "A4"
  }, [exam])

  /** 全ページの模範解答画像URL（ページ番号順） */
  const allMasterImageUrls = useMemo(() => {
    if (!exam?.examPages) return []
    return exam.examPages
      .slice()
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .map((page) => {
        const masterImage = page.masterImages?.[0]
        return masterImage?.imagePath
          ? `appimg:///${masterImage.imagePath}`
          : null
      })
      .filter((url): url is string => url !== null)
  }, [exam])

  /** hold-to-show用: keyupイベントで模範解答を非表示 */
  useEffect(() => {
    if (masterAnswerKeyBehavior !== "hold-to-show") return
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "x" || e.key === "X") {
        setMasterAnswerVisible(false)
      }
    }
    window.addEventListener("keyup", handleKeyUp)
    return () => window.removeEventListener("keyup", handleKeyUp)
  }, [masterAnswerKeyBehavior])

  /** コンテキスト値の設定 */
  useContextValue("gradingMode", gradingMode)
  useContextValue("hasSelectedAnswers", selectedStudentAnswerImageIds.size > 0)
  useContextValue("sidePanelVisible", showSidePanel)
  useContextValue("partialScoreModalOpen", showPartialScoreModal)
  useContextValue("modalOpen", showPartialScoreModal || showScoreComparison)
  useContextValue("scoringOperationMode", effectiveMode)

  /** キーボードショートカット登録 */
  useScoringShortcuts({
    handleToggleStudentNames,
    handleRefreshFilter,
    handleNextQuestion,
    handlePrevQuestion,
    handleGridNavigation,
    handleIndividualNavigation,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handlePartialScoreInput,
    handlePartialScoreConfirmPartial: () =>
      handlePartialScoreConfirm("partial"),
    handlePartialScoreConfirmPending: () =>
      handlePartialScoreConfirm("pending"),
    handlePartialScoreCancel,
    handlePartialScoreBackspace,
    handleScore: handleBatchScoreWithProgress,
    handleToggleFilter,
    handleSelectAll,
    handleToggleViewMode: handleToggleViewMode,
    handleToggleMasterAnswer,
    scoringOperationMode: effectiveMode,
  })

  const currentStudentId = useMemo(() => {
    if (selectedStudentAnswerImageIds.size > 0) {
      const selectedAnswerId = Array.from(selectedStudentAnswerImageIds)[0]
      const selectedAnswer = studentAnswerImages.find(
        (a) => a.id === selectedAnswerId
      )
      return selectedAnswer?.student?.id || ""
    }
    return ""
  }, [selectedStudentAnswerImageIds, studentAnswerImages])

  const questionProgress = calculateQuestionProgress()

  if (loading) {
    return <ScoringLoadingState />
  }

  if (!exam || studentAnswerImages.length === 0 || cropRegions.length === 0) {
    return (
      <ScoringErrorState
        exam={exam}
        answerSheetsLength={studentAnswerImages.length}
        cropRegionsLength={cropRegions.length}
        examId={examId}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Head>
        <title>{`採点 - ${exam.examName}`}</title>
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
          onOmrRecognitionClick={() => setShowOmrModal(true)}
        />
      </PageHeader>

      {/* 採点エリア */}
      <div className="relative flex h-full min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-1">
          <ScoringContentArea
            gradingMode={gradingMode}
            allScoringData={allScoringData}
            masterAnswerData={masterAnswerData}
            filteredScoringDataIds={filteredScoringDataIds}
            selectedScoringDataIds={selectedScoringDataIds}
            currentCropRegion={currentCropRegion}
            cropRegions={cropRegions}
            studentAnswerImages={studentAnswerImages}
            onScoringDataSelect={(dataId, isSelected) =>
              handleAnswerSelect(dataId, isSelected, studentAnswerImages)
            }
            onScoringDataReplace={handleReplaceSelection}
            layoutDirection={layoutDirection}
            itemsPerLine={itemsPerLine}
            autoScroll={autoScroll}
            showStudentNames={showStudentNames}
            currentStudentId={currentStudentId || undefined}
            currentUserId={currentUserId || undefined}
            questionScores={questionScores}
            onQuestionScoreCreated={handleQuestionScoreCreated}
            expandMargin={expandMargin}
            onAnnotationChanged={handleCanvasAnnotationChanged}
            annotationRefreshKey={annotationVersionForCanvas}
            gridAnnotationRefreshKey={annotationVersionForGrid}
            masterAnswerDisplayMode={masterAnswerDisplayMode}
            masterAnswerOpacity={masterAnswerOpacity}
            masterAnswerVisible={masterAnswerVisible}
            allMasterImageUrls={allMasterImageUrls}
            pageSize={pageSize}
            onClickScoring={handleClickScoring}
            clickScoringDebounceMs={clickScoringDebounceMs}
            scoringOperationMode={effectiveMode}
            mouseBrush={mouseBrush}
            onMouseScoring={handleMouseScoring}
          />
        </div>

        {/* 右側サイドパネル（スライドイン/アウト） */}
        <div
          className="shrink-0 transition-[width] duration-300 ease-in-out"
          style={{ width: showSidePanel ? "24rem" : "0" }}
        >
          <div className="h-full w-96">
            <ScoringSidePanel
              examId={examId}
              cropRegions={cropRegions}
              currentCropRegion={currentCropRegion}
              onCropRegionChange={(cropRegion) => {
                setCurrentCropRegionId(cropRegion?.id || null)
              }}
              onPrevQuestion={handlePrevQuestion}
              onNextQuestion={handleNextQuestion}
              questionProgress={questionProgress}
              selectedStudentAnswerImageIds={selectedStudentAnswerImageIds}
              selectedAnswersCount={selectedStudentAnswerImageIds.size}
              filterSettings={filterSettings}
              onScore={handleBatchScoreWithProgress}
              onToggleFilter={handleToggleFilter}
              onRefreshFilter={handleRefreshFilter}
              onSelectAll={handleSelectAll}
              onSelectUnscored={handleSelectUnscored}
              onOpenPartialScoreModal={openPartialScoreModal}
              partialScoreInput={partialScoreInput}
              clickScoringConfig={clickScoringConfig}
              clickScoringDebounceMs={clickScoringDebounceMs}
              onClickActionChange={setClickAction}
              onClickScoringDebounceMsChange={setClickScoringDebounceMs}
              layoutDirection={layoutDirection}
              visibleAnswersCount={visibleAnswers.length}
              totalAnswersCount={studentAnswerImages.length}
              onLayoutDirectionChange={setLayoutDirection}
              onGridNavigation={handleGridNavigation}
              itemsPerLine={itemsPerLine}
              onItemsPerLineChange={handleItemsPerLineChange}
              autoScroll={autoScroll}
              onAutoScrollChange={handleAutoScrollChange}
              gradingMode={gradingMode}
              expandMargin={expandMargin}
              onExpandMarginChange={setExpandMargin}
              students={students}
              onStudentChange={handleStudentChange}
              studentAnswerImages={studentAnswerImages}
              scoringBehavior={scoringBehavior}
              onScoringBehaviorChange={(behavior) =>
                setScoringBehavior(behavior)
              }
              currentUserId={currentUserId ?? undefined}
              selectedScoringDataIds={Array.from(selectedStudentAnswerImageIds)}
              questionScores={questionScores}
              allScoringData={allScoringData}
              onQuestionScoreCreated={handleQuestionScoreCreated}
              annotationRefreshKey={annotationVersionForBrowser}
              onAnnotationAddedFromBrowser={handleBrowserAnnotationAdded}
              masterAnswerDisplayMode={masterAnswerDisplayMode}
              masterAnswerOpacity={masterAnswerOpacity}
              masterAnswerKeyBehavior={masterAnswerKeyBehavior}
              onMasterAnswerDisplayModeChange={setMasterAnswerDisplayMode}
              onMasterAnswerOpacityChange={setMasterAnswerOpacity}
              onMasterAnswerKeyBehaviorChange={setMasterAnswerKeyBehavior}
              masterAnswerVisible={masterAnswerVisible}
              onToggleMasterAnswer={handleToggleMasterAnswer}
              onMasterAnswerShow={handleMasterAnswerShow}
              onMasterAnswerHide={handleMasterAnswerHide}
              scoringOperationMode={effectiveMode}
              onScoringOperationModeChange={setScoringOperationMode}
              mouseBrush={mouseBrush}
              onMouseBrushChange={setMouseBrush}
              visibleUnscoredCount={visibleUnscoredCount}
              hiddenUnscoredCount={hiddenUnscoredCount}
              onBatchScoreVisibleUnscored={handleBatchScoreVisibleUnscored}
            />
          </div>
        </div>
      </div>

      {/* OMR自動採点モーダル */}
      <OMRAutoScoringModal
        examId={examId}
        userId={currentUserId ?? ""}
        open={showOmrModal}
        onOpenChange={setShowOmrModal}
        onScoresApplied={handleQuestionScoreCreated}
      />

      {/* モード選択モーダル */}
      <ScoringModeModal
        open={showModeSelectionModal}
        onSelect={selectMode}
        onClose={closeModeSelectionModal}
      />

      {/* モーダル類 */}
      <ScoringModals
        showPartialScoreModal={showPartialScoreModal}
        partialScoreInput={partialScoreInput}
        currentCropRegion={currentCropRegion}
        onPartialScoreClose={handlePartialScoreCancel}
        onPartialScoreChange={handlePartialScoreChange}
        onPartialScoreConfirmPartial={() =>
          handlePartialScoreConfirm("partial")
        }
        onPartialScoreConfirmPending={() =>
          handlePartialScoreConfirm("pending")
        }
        onPartialScoreDigit={handlePartialScoreInput}
        onPartialScoreBackspace={handlePartialScoreBackspace}
        keyBindings={modalKeyBindings}
        showScoreComparison={showScoreComparison}
        onScoreComparisonClose={() => setShowScoreComparison(false)}
        currentAnswerSheet={currentAnswerSheet}
      />
    </div>
  )
}

export default function ScoringMainView() {
  return (
    <ShortcutProvider>
      <ScoringMainViewContent />
    </ShortcutProvider>
  )
}
