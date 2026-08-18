"use client"

import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query"
import Head from "next/head"
import { useParams, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"

import { useContextValue } from "@/components/exams/07-score-at-once/hooks/useContextValue"
import { OMRAutoScoringModal } from "@/components/exams/07-score-at-once/OMRRecognition/OMRAutoScoringModal"
import type { ScoringBehavior } from "@/components/exams/07-score-at-once/ScoringIndividual/ScoringBehaviorSelector"
import {
  ShortcutProvider,
  useShortcutContext,
} from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import { useAnswerWhiteness } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useAnswerWhiteness"
import { useAssignedCropRegions } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useAssignedCropRegions"
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
import { useScoringShortcuts } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringShortcuts"
import { useStudentAnswerManagement } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useStudentAnswerManagement"
import { useExamDecisionSummary } from "@/components/exams/07-score-at-once/ScoringMain/ScoreDecisionPanel/hooks/useExamDecisionSummary"
import { ScoreDecisionPanel } from "@/components/exams/07-score-at-once/ScoringMain/ScoreDecisionPanel/ScoreDecisionPanel"
import { ScoringContentArea } from "@/components/exams/07-score-at-once/ScoringMain/ScoringContentArea"
import { ScoringHeaderControls } from "@/components/exams/07-score-at-once/ScoringMain/ScoringHeaderControls"
import { ScoringModals } from "@/components/exams/07-score-at-once/ScoringMain/ScoringModals"
import { ScoringModeModal } from "@/components/exams/07-score-at-once/ScoringMain/ScoringModeModal"
import {
  buildScoringSettings,
  SCORING_PREFERENCE_KEYS,
} from "@/components/exams/07-score-at-once/ScoringMain/scoringPreferences"
import {
  ScoringErrorState,
  ScoringLoadingState,
} from "@/components/exams/07-score-at-once/ScoringMain/ScoringStates"
import { ScoringSidePanel } from "@/components/exams/07-score-at-once/ScoringSidePanel/ScoringSidePanel"
import type { MouseBrushAction } from "@/components/exams/07-score-at-once/types"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { useAuth } from "@/contexts/AuthContext"
import { resolveExamPaperSize } from "@/electron-src/lib/shared/utilities/examPaperSize"
import { cropRegionScopes } from "@/queries/cropRegion"
import {
  setUserPreferenceMutation,
  userPreferenceQuery,
} from "@/queries/settings"

/** 内部コンポーネント（ShortcutProvider内で使用） */
function ScoringMainViewContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const examId = params.examId as string
  const { user: authUser } = useAuth()
  const { helpButton } = usePageHelp()
  const { keyBindings } = useShortcutContext()
  const queryClient = useQueryClient()

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
  // 採点画面の設定。保存文字列を並べて取り、値の組み立ては純粋関数が行う
  const preferenceQueries = useQueries({
    queries: SCORING_PREFERENCE_KEYS.map((key) =>
      userPreferenceQuery(authUser?.id, key)
    ),
  })
  const setPreference = useMutation(setUserPreferenceMutation(authUser?.id))
  const scoringSettings = buildScoringSettings(
    preferenceQueries.map((preferenceQuery) => preferenceQuery.data ?? null),
    setPreference.mutate
  )
  const {
    itemsPerLine,
    autoScroll,
    showStudentNames,
    layoutDirection,
    answerSortOrder,
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
    setAnswerSortOrder,
    setExpandMargin,
    setClickAction,
    setClickScoringDebounceMs,
    setMasterAnswerDisplayMode,
    setMasterAnswerOpacity,
    setMasterAnswerKeyBehavior,
  } = scoringSettings

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
    currentCropRegionId,
    showKeyboardHelp,
    showScoreDecisionPanel,
    showSidePanel,
    modifierKeyLabel,
    /** アクション関数 */
    setGradingMode,
    setSelectedPageImageIds,
    setCurrentCropRegionId,
    setShowKeyboardHelp,
    setShowScoreDecisionPanel,
    setShowSidePanel,
    /** ヘルパー関数 */
    handleAnswerSelect,
    replaceSelection,
    manualSelectionVersion,
  } = useScoringMainState()

  /** 現在の設問 */
  const currentCropRegion = cropRegions.find(
    (cropRegion) => cropRegion.id === currentCropRegionId
  )

  /**
   * 採点担当による設問の絞り込み。
   * 自動選択・前後移動・設問ナビゲーターの選択肢だけをこの集合に置き換える
   * （描画やスコア引き当ては全設問を見る必要があるため差し替えない）。
   */
  const {
    selectableCropRegions,
    memberCount,
    refresh: refreshAssignments,
    isFiltered: isQuestionSetFiltered,
  } = useAssignedCropRegions({
    examId,
    userId: currentUserId ?? undefined,
    cropRegions,
  })

  /** 白さ順ソート用: 一覧表示中のページの白さを先読みする */
  const { whitenessByAnswerId, isWhitenessReady } = useAnswerWhiteness({
    studentAnswerImages,
    cropRegions,
    currentExamPageId: currentCropRegion?.examPageId ?? null,
    enabled: gradingMode === "grid",
  })

  /** Effect処理フック */
  useScoringEffects({
    gradingMode,
    selectedStudentAnswerImageIds,
    studentAnswerImages,
    cropRegions: selectableCropRegions,
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
  })

  /** 採点データ管理hook */
  const { handleBatchScore, calculateQuestionProgress } = useScoringData({
    examId,
    currentUserId,
    currentCropRegionId,
    studentAnswerImages,
    cropRegions,
  })

  /**
   * 採点行を取り直す。
   *
   * 採点行は採点領域の子として載っているので、取り直す先は採点領域のまとまり。
   * 採点の書き込みは自分で取り直すので、これが要るのは**手で頼まれたとき**
   * （裁定パネルの再読み込みボタン・OMR の取り込み後）だけである。
   */
  const handleQuestionScoreCreated = useCallback(async () => {
    await Promise.all(
      cropRegionScopes(examId).map((queryKey) =>
        queryClient.invalidateQueries({ queryKey })
      )
    )
  }, [queryClient, examId])

  /** 裁定状況（採点者間の食い違い・確定後の新提案） */
  const {
    summary: decisionSummary,
    loading: decisionLoading,
    error: decisionError,
    refresh: refreshDecisionSummary,
  } = useExamDecisionSummary(
    examId,
    currentUserId ?? undefined,
    // 単独利用（メンバー1人）では裁定サマリを引かない。全採点行の走査を
    // 画面入場ごとに払わないため（競合は構造的にゼロで結果は常に空）。
    memberCount > 1
  )

  const pendingDecisionCount =
    (decisionSummary?.conflictCount ?? 0) + (decisionSummary?.staleCount ?? 0)

  /**
   * 単独利用では割当・確定のUIを一切出さない。
   * メンバーが1人なら分担する相手がおらず、提案も常に1件なので
   * 競合は構造的にゼロになる（＝このパネルに用が無い）。
   * 裁定サマリを引くかの条件と同じものを使い、両者がずれないようにする。
   */
  const showDecisionEntry = memberCount > 1

  /** 確定後は裁定状況と採点データの両方を取り直す */
  const handleScoreDecided = useCallback(async () => {
    await Promise.all([refreshDecisionSummary(), handleQuestionScoreCreated()])
  }, [refreshDecisionSummary, handleQuestionScoreCreated])

  /** 担当割当の変更は、裁定サマリと採点画面の選択可能設問の両方に効く */
  const handleAssignmentChanged = useCallback(async () => {
    await Promise.all([refreshDecisionSummary(), refreshAssignments()])
  }, [refreshDecisionSummary, refreshAssignments])

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
    currentUserId,
    selectedStudentAnswerImageIds: selectedStudentAnswerImageIds,
    setSelectedPageImageIds: setSelectedPageImageIds,
    exam,
    gradingMode,
    questionChangeVersion,
    manualSelectionVersion,
    answerSortOrder,
    whitenessByAnswerId,
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
        .filter((scoringData) => scoringData.status === "unscored")
        .map((scoringData) => scoringData.id)
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
      cropRegions: selectableCropRegions,
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
      handleBatchScore(action, null, null, targetSet)
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
        const currentData = allScoringData.find(
          (scoringData) => scoringData.id === answerId
        )
        if (currentData?.status === status) {
          const targetSet = new Set([answerId])
          handleBatchScore("unscored", null, null, targetSet)
          setRecentlyScoredAnswers((prev) => {
            const newSet = new Set(prev)
            newSet.add(answerId)
            return newSet
          })
          return
        }
      }

      const targetSet = new Set([answerId])
      handleBatchScore(status, null, null, targetSet)
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
        (scoringData) =>
          scoringData.status === "unscored" &&
          filteredScoringDataIds.includes(scoringData.id)
      )
      if (unscoredVisible.length === 0) return
      const targetSet = new Set(
        unscoredVisible.map((scoringData) => scoringData.id)
      )
      handleBatchScore(status, null, null, targetSet)
      setRecentlyScoredAnswers((prev) => {
        const newSet = new Set(prev)
        unscoredVisible.forEach((scoringData) => newSet.add(scoringData.id))
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
        (scoringData) =>
          scoringData.status === "unscored" &&
          filteredScoringDataIds.includes(scoringData.id)
      ).length,
    [allScoringData, filteredScoringDataIds]
  )

  /** 非表示の未採点件数 */
  const hiddenUnscoredCount = useMemo(
    () =>
      allScoringData.filter(
        (scoringData) =>
          scoringData.status === "unscored" &&
          !filteredScoringDataIds.includes(scoringData.id)
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

  /** 用紙サイズ。PDF出力（pdfExport）と同じ関数で決めて注釈のmm→px変換基準を揃える */
  const pageSize = useMemo(
    () => resolveExamPaperSize(exam?.examPages),
    [exam?.examPages]
  )

  /** 全ページの模範解答画像URL（ページ番号順） */
  const allMasterImageUrls = useMemo(() => {
    if (!exam?.examPages) return []
    return exam.examPages
      .slice()
      .sort((pageA, pageB) => pageA.pageNumber - pageB.pageNumber)
      .map((page) => (page.imagePath ? `appimg:///${page.imagePath}` : null))
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
  useContextValue("modalOpen", showPartialScoreModal || showScoreDecisionPanel)
  useContextValue("scoringOperationMode", effectiveMode)

  /**
   * 担当が外れて選べなくなった設問に留まらせない。
   * null に戻すと useScoringEffects が担当集合の先頭を選び直す。
   */
  useEffect(() => {
    if (!currentCropRegionId || selectableCropRegions.length === 0) return
    const isSelectable = selectableCropRegions.some(
      (cropRegion) => cropRegion.id === currentCropRegionId
    )
    if (!isSelectable) {
      setCurrentCropRegionId(null)
    }
  }, [currentCropRegionId, selectableCropRegions, setCurrentCropRegionId])

  /** 出力前警告からの誘導（?decide=1）で確定パネルを開く */
  useEffect(() => {
    if (searchParams?.get("decide") === "1") {
      setShowScoreDecisionPanel(true)
    }
  }, [searchParams, setShowScoreDecisionPanel])

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

  const currentExamStudentId = useMemo(() => {
    if (selectedStudentAnswerImageIds.size > 0) {
      const selectedAnswerId = Array.from(selectedStudentAnswerImageIds)[0]
      const selectedAnswer = studentAnswerImages.find(
        (answerImage) => answerImage.id === selectedAnswerId
      )
      return selectedAnswer?.examStudentId || ""
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
          onScoreDecisionClick={
            showDecisionEntry
              ? () => setShowScoreDecisionPanel(true)
              : undefined
          }
          pendingDecisionCount={pendingDecisionCount}
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
            currentExamStudentId={currentExamStudentId || undefined}
            currentUserId={currentUserId || undefined}
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
              cropRegions={selectableCropRegions}
              currentCropRegion={currentCropRegion}
              onCropRegionChange={(cropRegion) => {
                setCurrentCropRegionId(cropRegion?.id || null)
              }}
              onPrevQuestion={handlePrevQuestion}
              onNextQuestion={handleNextQuestion}
              questionProgress={questionProgress}
              isQuestionSetFiltered={isQuestionSetFiltered}
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
              answerSortOrder={answerSortOrder}
              onAnswerSortOrderChange={setAnswerSortOrder}
              isWhitenessReady={isWhitenessReady}
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

      {/* 採点結果の確定（裁定）パネル */}
      <ScoreDecisionPanel
        examId={examId}
        isOpen={showScoreDecisionPanel}
        onClose={() => setShowScoreDecisionPanel(false)}
        summary={decisionSummary}
        loading={decisionLoading}
        error={decisionError}
        onRefresh={handleScoreDecided}
        onAssignmentChanged={handleAssignmentChanged}
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
