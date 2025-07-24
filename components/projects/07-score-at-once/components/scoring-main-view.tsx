"use client"

import LoadingSpinner from "@/components/common/LoadingSpinner"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import AnswerDisplayViewer from "@/components/projects/07-score-at-once/AnswerDisplayViewer"
import AnswerGridView from "@/components/projects/07-score-at-once/AnswerGridView"
import NavigationControls from "@/components/projects/07-score-at-once/components/navigation-controls"
import PartialScoreModal from "@/components/projects/07-score-at-once/components/PartialScoreModal"
import QuestionNavigator from "@/components/projects/07-score-at-once/components/question-navigator"
import ScoringToolbar from "@/components/projects/07-score-at-once/components/scoring-toolbar"
import GradingModeToggle, {
  GradingMode,
} from "@/components/projects/07-score-at-once/GradingModeToggle"
import {
  getModifierKeyLabel,
  usePartialScore,
  useScoringData,
  useScoringFilter,
  useScoringKeyboard,
  useScoringNavigation,
} from "@/components/projects/07-score-at-once/hooks"
import { useScoringDataLoader } from "@/components/projects/07-score-at-once/hooks/use-scoring-data-loader"
import { useScoringSettings } from "@/components/projects/07-score-at-once/hooks/use-scoring-settings"
import ProjectProgressCard from "@/components/projects/07-score-at-once/ProjectProgressCard"
import ScoreComparisonModal from "@/components/projects/07-score-at-once/ScoreComparisonModal"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Keyboard, PanelRightClose, PanelRightOpen } from "lucide-react"
import Head from "next/head"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

export default function ScoringMainView() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string
  const { helpButton } = usePageHelp()

  // データローダーフック
  const {
    loading,
    project,
    answerSheets,
    questionRegions,
    currentUserId,
    error: _error,
  } = useScoringDataLoader(projectId)

  // 設定管理フック
  const {
    itemsPerRow,
    autoScroll,
    showStudentNames,
    setItemsPerRow,
    setAutoScroll,
    setShowStudentNames,
  } = useScoringSettings()

  // 採点モード状態
  const [gradingMode, setGradingMode] = useState<GradingMode>("grid")
  const [selectedAnswers, setSelectedAnswers] = useState<Set<string>>(new Set())
  const [gridSize, _setGridSize] = useState({ columns: 4, rows: 3 })
  const [layoutDirection, setLayoutDirection] = useState<
    "right-down" | "left-down" | "down-right" | "down-left"
  >("right-down")
  const [effectiveColumns, setEffectiveColumns] = useState<number>(5)
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const [showScoreComparison, setShowScoreComparison] = useState(false)
  const [showSidePanel, setShowSidePanel] = useState(true)
  const [modifierKeyLabel, setModifierKeyLabel] = useState("Alt")


  // 現在の答案と設問
  const currentAnswerSheet = answerSheets[currentStudentIndex]
  const currentQuestion = questionRegions[currentQuestionIndex]

  // プラットフォーム固有のキーラベルを初期化
  useEffect(() => {
    setModifierKeyLabel(getModifierKeyLabel())
  }, [])

  // 採点データ管理hook
  const {
    scoringData,
    setScoringData,
    loadExistingScoringData,
    handleSetScore,
    handleBatchScore,
    calculateQuestionProgress,
  } = useScoringData({
    currentUserId,
    setCurrentUserId: () => {}, // データローダーで管理するため空関数
    gradingMode,
    currentStudentIndex,
    setCurrentStudentIndex,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    answerSheets,
    questionRegions,
  })

  // フィルタリング管理hook
  const {
    filterSettings,
    visibleAnswers,
    setRecentlyScoredAnswers,
    getGridAnswerData,
    handleRefreshFilter,
    handleToggleFilter,
    handleToggleFilterByScoreKey,
  } = useScoringFilter({
    answerSheets,
    questionRegions,
    currentQuestionIndex,
    scoringData,
    selectedAnswers,
    setSelectedAnswers,
    project,
  })

  // ナビゲーション管理hook
  const {
    imageZoom,
    setImageZoom,
    imagePosition,
    setImagePosition,
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
    answerSheetsLength: answerSheets.length,
    questionRegionsLength: questionRegions.length,
    currentStudentIndex,
    setCurrentStudentIndex,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    selectedAnswers,
    setSelectedAnswers,
    gridSize,
    layoutDirection,
    getGridAnswerData,
    effectiveColumns,
  })

  // 自動進行機能付きのhandleBatchScore（ラッパー）
  const handleBatchScoreWithProgress = useCallback(async (
    statusOrAnswerIds: any,
    statusOrPartialScore?: any,
    partialScore?: any,
  ) => {
    
    // 採点実行開始
    
    // 最近採点した答案を記録（先に実行）
    const answerIds = Array.from(selectedAnswers)
    setRecentlyScoredAnswers(prev => {
      const newSet = new Set(prev)
      answerIds.forEach(id => newSet.add(id))
      return newSet
    })

    // その後で採点実行
    await handleBatchScore(
      statusOrAnswerIds,
      statusOrPartialScore,
      partialScore,
      selectedAnswers,
    )

    // 採点後の自動次答案選択（一覧採点モード用）
    if (gradingMode === "grid" && selectedAnswers.size >= 1) {
      const gridAnswers = getGridAnswerData()

      // 最適化: 答案IDのインデックスマップを事前作成
      const answerIndexMap = new Map<string, number>()
      gridAnswers.forEach((answer, index) => {
        answerIndexMap.set(answer.id, index)
      })

      // 複数選択の場合は最終答案（最後にソートされた答案）を基準にする
      let maxIndex = -1
      for (const selectedId of selectedAnswers) {
        const index = answerIndexMap.get(selectedId)
        if (index !== undefined && index > maxIndex) {
          maxIndex = index
        }
      }

      if (maxIndex >= 0 && maxIndex < gridAnswers.length - 1) {
        // 最終答案の次の答案を選択（模範解答をスキップ）
        let nextIndex = maxIndex + 1
        while (
          nextIndex < gridAnswers.length &&
          gridAnswers[nextIndex].id.startsWith("master-")
        ) {
          nextIndex++
        }

        if (nextIndex < gridAnswers.length) {
          const nextAnswerId = gridAnswers[nextIndex].id
          setSelectedAnswers(new Set([nextAnswerId]))
        } else {
          // 選択をクリアせず保持する
        }
      } else {
        // 選択をクリアせず保持する
      }
    } else {
      // 選択をクリアせず保持する
    }
    
    // 採点実行完了
    
  }, [selectedAnswers, gradingMode, setRecentlyScoredAnswers, handleBatchScore, getGridAnswerData, setSelectedAnswers])

  // 自動進行関数
  const handleAutoAdvance = useCallback(() => {
    if (gradingMode === "grid") {
      // グリッドモードでは次の答案に移動
      handleGridNavigation("d")
    } else {
      // 個別モードでは次の学生に移動
      handleNextStudent()
    }
  }, [gradingMode, handleGridNavigation, handleNextStudent])

  // 部分点入力管理hook
  const {
    partialScoreInput,
    showPartialScoreModal,
    handlePartialScoreInput,
    handlePartialScoreConfirm,
    handlePartialScoreCancel,
    handlePartialScoreBackspace,
    handlePartialScoreChange,
  } = usePartialScore({
    selectedAnswers,
    currentQuestion,
    onBatchScore: handleBatchScoreWithProgress, // 自動進行機能付きに変更
    onAutoAdvance: handleAutoAdvance,
  })

  // 生徒名表示設定の変更
  const handleToggleStudentNames = useCallback(() => {
    setShowStudentNames(!showStudentNames)
  }, [showStudentNames, setShowStudentNames])

  // キーボードハンドリングhook
  useScoringKeyboard({
    gradingMode,
    selectedAnswers,
    onBatchScore: handleBatchScoreWithProgress, // 自動進行機能付きに変更
    onSetScore: handleSetScore,
    onNextQuestion: handleNextQuestion,
    onPrevQuestion: handlePrevQuestion,
    onNextStudent: handleNextStudent,
    onPrevStudent: handlePrevStudent,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onResetZoom: handleResetZoom,
    onToggleViewMode: toggleViewMode,
    onGridNavigation: handleGridNavigation,
    onToggleFilterByScoreKey: handleToggleFilterByScoreKey,
    onRefreshFilter: handleRefreshFilter,
    onPartialScoreInput: handlePartialScoreInput,
    onPartialScoreConfirm: handlePartialScoreConfirm,
    onPartialScoreCancel: handlePartialScoreCancel,
    onPartialScoreBackspace: handlePartialScoreBackspace,
    showPartialScoreModal,
    onToggleFilter: handleToggleFilter,
    onToggleStudentNames: handleToggleStudentNames,
  })

  // 採点データの初期化
  useEffect(() => {
    const initializeGradingData = async () => {
      if (!loading && project) {
        try {
          // 既存の採点データを読み込み
          const existingScores = await loadExistingScoringData(projectId)
          setScoringData(existingScores)
        } catch (error) {
          console.error("Failed to initialize grading data:", error)
        }
      }
    }

    initializeGradingData()
  }, [projectId, loading, project, loadExistingScoringData, setScoringData])

  // 設定の初期化
  useEffect(() => {
    // 実際の列数を更新（設定フックから取得）
    setEffectiveColumns(itemsPerRow[0])
  }, [itemsPerRow])

  // 設定変更ハンドラー
  const handleItemsPerRowChange = (value: number[]) => {
    setItemsPerRow(value)
    setEffectiveColumns(value[0])
  }

  const handleAutoScrollChange = (enabled: boolean) => {
    setAutoScroll(enabled)
  }

  // 設問別進捗を計算
  const questionProgress = calculateQuestionProgress()

  // グリッドビュー用のヘルパー関数
  const handleAnswerSelect = (answerId: string, isSelected: boolean) => {
    // 模範解答は選択対象外
    if (answerId.startsWith("master-")) {
      return
    }

    // 答案が実際に存在するかチェック
    const answerExists = answerSheets.some((sheet) => sheet.id === answerId)
    if (!answerExists) {
      return
    }

    setSelectedAnswers((prev) => {
      const newSet = new Set(prev)
      if (isSelected) {
        newSet.add(answerId)
      } else {
        newSet.delete(answerId)
      }
      return newSet
    })
  }


  if (loading) {
    return (
      <div className="flex flex-1">
        <div className="flex flex-1 items-center justify-center">
          <LoadingSpinner text="採点データを読み込み中..." />
        </div>
      </div>
    )
  }

  if (!project || answerSheets.length === 0 || questionRegions.length === 0) {
    return (
      <div className="flex flex-1">
        <div className="flex flex-1 items-center justify-center">
          <div className="space-y-4 text-center">
            <h2 className="text-xl font-semibold text-gray-700">
              採点を開始できません
            </h2>
            <div className="space-y-1 text-sm text-gray-500">
              {!project && <p>• プロジェクト情報が見つかりません</p>}
              {answerSheets.length === 0 && (
                <p>• 答案がアップロードされていません</p>
              )}
              {questionRegions.length === 0 && (
                <p>• 採点領域が設定されていません</p>
              )}
            </div>
            <Button
              onClick={() => router.push(`/projects/${projectId}`)}
              variant="outline"
            >
              プロジェクト詳細に戻る
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Head>
        <title>{`採点 - ${project.examName}`}</title>
      </Head>

      {/* PageHeader */}
      <PageHeader
        title="採点"
        description="答案を採点し、点数を入力します"
        helpButton={helpButton}
      >
        <div className="flex items-center space-x-2">
          {/* 採点モード切り替え */}
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-700">
              採点モード:
            </span>
            <GradingModeToggle
              mode={gradingMode}
              onModeChange={setGradingMode}
            />
          </div>

          {/* キーボードヘルプ */}
          <Dialog open={showKeyboardHelp} onOpenChange={setShowKeyboardHelp}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Keyboard className="mr-2 h-4 w-4" />
                キーボード
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>キーボードショートカット</DialogTitle>
                <DialogDescription>
                  効率的な採点のためのキーボードショートカット一覧
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="mb-3 font-medium">採点操作</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>未採点</span>
                      <code className="rounded bg-gray-100 px-2 py-1">Q</code>
                    </div>
                    <div className="flex justify-between">
                      <span>正答</span>
                      <code className="rounded bg-gray-100 px-2 py-1">E</code>
                    </div>
                    <div className="flex justify-between">
                      <span>部分点</span>
                      <code className="rounded bg-gray-100 px-2 py-1">F</code>
                    </div>
                    <div className="flex justify-between">
                      <span>保留</span>
                      <code className="rounded bg-gray-100 px-2 py-1">J</code>
                    </div>
                    <div className="flex justify-between">
                      <span>誤答</span>
                      <code className="rounded bg-gray-100 px-2 py-1">O</code>
                    </div>
                    <div className="flex justify-between">
                      <span>無答</span>
                      <code className="rounded bg-gray-100 px-2 py-1">P</code>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="mb-3 font-medium">ナビゲーション</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>前の設問</span>
                      <code className="rounded bg-gray-100 px-2 py-1">
                        Shift+A
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span>次の設問</span>
                      <code className="rounded bg-gray-100 px-2 py-1">
                        Shift+D
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span>WASD移動</span>
                      <code className="rounded bg-gray-100 px-2 py-1">
                        WASD
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span>フィルタ更新</span>
                      <code className="rounded bg-gray-100 px-2 py-1">R</code>
                    </div>
                    <div className="flex justify-between">
                      <span>フィルタ切替</span>
                      <code className="rounded bg-gray-100 px-2 py-1">
                        {modifierKeyLabel}+採点キー
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span>部分点入力</span>
                      <code className="rounded bg-gray-100 px-2 py-1">
                        0-9,.
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span>部分点リセット</span>
                      <code className="rounded bg-gray-100 px-2 py-1">
                        Backspace
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span>フィルタ切替(数字)</span>
                      <code className="rounded bg-gray-100 px-2 py-1">
                        Ctrl+1-6
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* サイドパネル表示切り替え */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSidePanel(!showSidePanel)}
          >
            {showSidePanel ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </Button>

          {helpButton}
        </div>
      </PageHeader>

      {/* 採点エリア */}
      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 p-6">
          {gradingMode === "individual" ? (
            <AnswerDisplayViewer
              answerSheet={currentAnswerSheet}
              currentQuestion={currentQuestion}
              viewMode={viewMode}
              zoom={imageZoom}
              position={imagePosition}
              onZoomChange={setImageZoom}
              onPositionChange={setImagePosition}
              onViewModeChange={setViewMode}
            />
          ) : (
            <AnswerGridView
              answers={getGridAnswerData()}
              currentQuestionIndex={currentQuestionIndex}
              layoutDirection={layoutDirection}
              gridSize={gridSize}
              onAnswerSelect={handleAnswerSelect}
              onAnswerScore={handleBatchScoreWithProgress}
              selectedAnswers={selectedAnswers}
              onEffectiveColumnsChange={setEffectiveColumns}
              itemsPerRow={itemsPerRow}
              autoScroll={autoScroll}
              showStudentNames={showStudentNames}
            />
          )}
        </div>

        {/* 右側サイドパネル */}
        {showSidePanel && (
          <div className="w-96 overflow-y-auto border-l border-gray-200 bg-gray-50 p-4">
            {/* 設問ナビゲーター */}
            <QuestionNavigator
              questionRegions={questionRegions}
              currentQuestionIndex={currentQuestionIndex}
              onQuestionChange={setCurrentQuestionIndex}
              onPrevQuestion={handlePrevQuestion}
              onNextQuestion={handleNextQuestion}
              questionProgress={questionProgress}
            />

            {/* 採点ツールバー */}
            <ScoringToolbar
              selectedAnswersCount={selectedAnswers.size}
              currentQuestion={currentQuestion}
              filterSettings={filterSettings}
              onScore={handleBatchScoreWithProgress}
              onToggleFilter={handleToggleFilter}
              onRefreshFilter={handleRefreshFilter}
              partialScoreInput={partialScoreInput}
              modifierKeyLabel={modifierKeyLabel}
            />

            {/* ナビゲーション制御 */}
            <NavigationControls
              layoutDirection={layoutDirection}
              selectedAnswersCount={selectedAnswers.size}
              visibleAnswersCount={visibleAnswers.size}
              totalAnswersCount={answerSheets.length}
              onLayoutDirectionChange={setLayoutDirection}
              onGridNavigation={handleGridNavigation}
              onRefreshView={handleRefreshFilter}
              itemsPerRow={itemsPerRow}
              onItemsPerRowChange={handleItemsPerRowChange}
              autoScroll={autoScroll}
              onAutoScrollChange={handleAutoScrollChange}
            />

            {/* プロジェクト進捗 */}
            <ProjectProgressCard projectId={projectId} />
          </div>
        )}
      </div>

      {/* モーダル類 */}
      <div>
        {/* 部分点入力モーダル */}
        <PartialScoreModal
          isOpen={showPartialScoreModal}
          value={partialScoreInput}
          maxPoints={currentQuestion?.points || 0}
          questionLabel={
            currentQuestion?.label || `問${currentQuestion?.orderIndex || 1}`
          }
          onClose={handlePartialScoreCancel}
          onChange={handlePartialScoreChange}
        />

        {/* 採点比較モーダル */}
        <ScoreComparisonModal
          isOpen={showScoreComparison}
          onClose={() => setShowScoreComparison(false)}
          answerSheetId={currentAnswerSheet?.id || ""}
          layoutRegionId={currentQuestion?.id || ""}
          questionLabel={
            currentQuestion?.label || `問${currentQuestion?.orderIndex || 1}`
          }
          maxScore={currentQuestion?.points || 0}
          studentName={
            currentAnswerSheet
              ? `${currentAnswerSheet.student.lastName} ${currentAnswerSheet.student.firstName}`
              : ""
          }
        />
      </div>
    </div>
  )
}
