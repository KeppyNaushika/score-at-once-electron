"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import Head from "next/head"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Keyboard,
  Settings,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react"
import LoadingSpinner from "@/components/common/LoadingSpinner"
import AnswerDisplayViewer from "../AnswerDisplayViewer"
import AnswerGridView from "../AnswerGridView"
import GradingModeToggle, { GradingMode } from "../GradingModeToggle"
import ProjectProgressCard from "../ProjectProgressCard"
import ScoreComparisonModal from "../ScoreComparisonModal"
import ScoringToolbar from "./scoring-toolbar"
import QuestionNavigator from "./question-navigator"
import NavigationControls from "./navigation-controls"
import PartialScoreModal from "./PartialScoreModal"
import { usePageHelp } from "@/components/help/usePageHelp"
import { LAYOUT_REAGION_AREA_TYPES } from "@/types/common.types"
import {
  useScoringKeyboard,
  useScoringData,
  useScoringFilter,
  useScoringNavigation,
  usePartialScore,
  getModifierKeyLabel,
  DEFAULT_SHORTCUTS,
} from "../hooks"

export default function ScoringMainView() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string
  const { helpButton } = usePageHelp()

  // 採点モード状態
  const [gradingMode, setGradingMode] = useState<GradingMode>("grid")
  const [selectedAnswers, setSelectedAnswers] = useState<Set<string>>(new Set())
  const [gridSize, setGridSize] = useState({ columns: 4, rows: 3 })
  const [layoutDirection, setLayoutDirection] = useState<
    "right-down" | "left-down" | "down-right" | "down-left"
  >("right-down")
  const [effectiveColumns, setEffectiveColumns] = useState<number>(5) // 実際の表示列数

  // 状態管理
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<any>(null)
  const [answerSheets, setAnswerSheets] = useState<any[]>([])
  const [questionRegions, setQuestionRegions] = useState<any[]>([])
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const [showScoreComparison, setShowScoreComparison] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showSidePanel, setShowSidePanel] = useState(true)
  const [modifierKeyLabel, setModifierKeyLabel] = useState('Alt')

  // Refs
  const imageRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

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
    getScoringStatus,
    handleSetScore,
    handleBatchScore,
  } = useScoringData({
    projectId,
    currentUserId,
    setCurrentUserId,
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
    setFilterSettings,
    visibleAnswers,
    getAllGridAnswerData,
    getGridAnswerData,
    getMasterAnswerData,
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

  // 部分点入力管理hook
  const {
    partialScoreInput,
    showPartialScoreModal,
    handlePartialScoreInput,
    handlePartialScoreConfirm,
    handlePartialScoreCancel,
    handlePartialScoreBackspace,
  } = usePartialScore({
    selectedAnswers,
    currentQuestion,
    onBatchScore: handleBatchScore,
  })

  // キーボードハンドリングhook
  useScoringKeyboard({
    gradingMode,
    selectedAnswers,
    currentStudentIndex,
    currentQuestionIndex,
    answerSheetsLength: answerSheets.length,
    questionRegionsLength: questionRegions.length,
    onBatchScore: handleBatchScore,
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
  })

  // データの初期読み込み
  useEffect(() => {
    const initializeGradingData = async () => {
      setLoading(true)
      try {
        // 現在のユーザーを取得
        const currentUser = await window.electronAPI.getCurrentUser()
        if (currentUser) {
          setCurrentUserId(currentUser.id)
        } else {
          console.error("No current user found")
        }

        // プロジェクト情報を取得
        const projectData = await window.electronAPI.fetchProjectById(projectId)
        if (projectData) {
          setProject(projectData)
        }

        // 答案データを取得
        const answersResult = await window.electronAPI.getAnswerSheetsByProjectId(projectId)
        if (!answersResult.success) {
          throw new Error(answersResult.error || "Failed to fetch answer sheets")
        }

        // レイアウト領域（設問）データを取得
        const regionsResult = await window.electronAPI.getLayoutRegionsByProjectId(projectId)

        // 設問領域のみをフィルタリング
        const questionRegions = (
          Array.isArray(regionsResult) ? regionsResult : []
        )
          .filter(
            (region: any) =>
              LAYOUT_REAGION_AREA_TYPES.includes(region.type) &&
              region.type === "QUESTION_ANSWER" &&
              region.questionNumber,
          )
          .map((region: any) => ({
            id: region.id,
            label: region.label,
            questionNumber: region.questionNumber,
            points: region.points || 0,
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height,
            masterImageId: region.masterImageId,
          }))

        // 既存の採点データを取得
        const existingScores = await loadExistingScoringData(projectId)

        // Transform the data to match AnswerSheet interface
        const transformedAnswerSheets = (answersResult.answerSheets || []).map((sheet: any) => ({
          id: sheet.id,
          studentId: sheet.studentId,
          projectId: sheet.projectId,
          imagePath: sheet.originalImagePath || "",
          pageNumber: sheet.pageNumber || 1,
          status: sheet.status || "uploaded",
          student: sheet.student,
        }))
        
        setAnswerSheets(transformedAnswerSheets)
        setQuestionRegions(questionRegions)
        setScoringData(existingScores)
      } catch (error) {
        console.error("Failed to initialize grading data:", error)
      } finally {
        setLoading(false)
      }
    }

    initializeGradingData()
  }, [projectId, loadExistingScoringData, setScoringData])

  // グリッドビュー用のヘルパー関数
  const handleAnswerSelect = (answerId: string, isSelected: boolean) => {
    // 模範解答は選択対象外
    if (answerId.startsWith('master-')) {
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

  // 自動進行機能付きのhandleBatchScore（ラッパー）
  const handleBatchScoreWithProgress = async (
    statusOrAnswerIds: any,
    statusOrPartialScore?: any,
    partialScore?: any,
  ) => {
    await handleBatchScore(statusOrAnswerIds, statusOrPartialScore, partialScore, selectedAnswers)

    // 採点後の自動次答案選択（一覧採点モード用）
    if (gradingMode === "grid" && selectedAnswers.size === 1) {
      const currentSelectedId = Array.from(selectedAnswers)[0]
      const gridAnswers = getGridAnswerData()
      const currentIndex = gridAnswers.findIndex(
        (answer) => answer.id === currentSelectedId,
      )

      if (currentIndex >= 0 && currentIndex < gridAnswers.length - 1) {
        // 次の答案を選択
        const nextAnswerId = gridAnswers[currentIndex + 1].id
        setSelectedAnswers(new Set([nextAnswerId]))
      } else {
        // 最後の答案の場合は選択をクリア
        setSelectedAnswers(new Set())
      }
    } else {
      // 選択をクリア
      setSelectedAnswers(new Set())
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen">
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner text="採点データを読み込み中..." />
        </div>
      </div>
    )
  }

  if (!project || answerSheets.length === 0 || questionRegions.length === 0) {
    return (
      <div className="flex min-h-screen">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold text-gray-700">採点を開始できません</h2>
            <div className="text-sm text-gray-500 space-y-1">
              {!project && <p>• プロジェクト情報が見つかりません</p>}
              {answerSheets.length === 0 && <p>• 答案がアップロードされていません</p>}
              {questionRegions.length === 0 && <p>• 採点領域が設定されていません</p>}
            </div>
            <Button onClick={() => router.push(`/projects/${projectId}`)} variant="outline">
              プロジェクト詳細に戻る
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>{`採点 - ${project.examName}`}</title>
      </Head>

      <div className="flex min-h-screen bg-gray-50">
        {/* メインコンテンツエリア */}
        <div className="flex-1 flex flex-col">
          {/* ヘッダー */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/projects/${projectId}`)}
                  className="text-gray-600"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  プロジェクト詳細
                </Button>
                <div className="text-lg font-semibold">{project.examName}</div>
                <div className="text-sm text-gray-500">
                  {currentQuestion ? (
                    <>
                      {currentQuestion.questionNumber} ({currentQuestion.points}点)
                    </>
                  ) : (
                    "設問を選択してください"
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {/* 採点モード切り替え */}
                <GradingModeToggle
                  mode={gradingMode}
                  onModeChange={setGradingMode}
                  className="mr-4"
                />

                {/* キーボードヘルプ */}
                <Dialog open={showKeyboardHelp} onOpenChange={setShowKeyboardHelp}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Keyboard className="h-4 w-4 mr-2" />
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
                        <h4 className="font-medium mb-3">採点操作</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>未採点</span>
                            <code className="bg-gray-100 px-2 py-1 rounded">Q</code>
                          </div>
                          <div className="flex justify-between">
                            <span>正答</span>
                            <code className="bg-gray-100 px-2 py-1 rounded">E</code>
                          </div>
                          <div className="flex justify-between">
                            <span>部分点</span>
                            <code className="bg-gray-100 px-2 py-1 rounded">F</code>
                          </div>
                          <div className="flex justify-between">
                            <span>保留</span>
                            <code className="bg-gray-100 px-2 py-1 rounded">J</code>
                          </div>
                          <div className="flex justify-between">
                            <span>誤答</span>
                            <code className="bg-gray-100 px-2 py-1 rounded">O</code>
                          </div>
                          <div className="flex justify-between">
                            <span>無答</span>
                            <code className="bg-gray-100 px-2 py-1 rounded">P</code>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-medium mb-3">ナビゲーション</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>前の設問</span>
                            <code className="bg-gray-100 px-2 py-1 rounded">←</code>
                          </div>
                          <div className="flex justify-between">
                            <span>次の設問</span>
                            <code className="bg-gray-100 px-2 py-1 rounded">→</code>
                          </div>
                          <div className="flex justify-between">
                            <span>WASD移動</span>
                            <code className="bg-gray-100 px-2 py-1 rounded">WASD</code>
                          </div>
                          <div className="flex justify-between">
                            <span>フィルタ更新</span>
                            <code className="bg-gray-100 px-2 py-1 rounded">R</code>
                          </div>
                          <div className="flex justify-between">
                            <span>フィルタ切替</span>
                            <code className="bg-gray-100 px-2 py-1 rounded">{modifierKeyLabel}+採点キー</code>
                          </div>
                          <div className="flex justify-between">
                            <span>部分点入力</span>
                            <code className="bg-gray-100 px-2 py-1 rounded">0-9,.</code>
                          </div>
                          <div className="flex justify-between">
                            <span>部分点リセット</span>
                            <code className="bg-gray-100 px-2 py-1 rounded">Backspace</code>
                          </div>
                          <div className="flex justify-between">
                            <span>フィルタ切替(数字)</span>
                            <code className="bg-gray-100 px-2 py-1 rounded">Ctrl+1-6</code>
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
            </div>

            {/* 簡潔な状態表示 */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-600">
                設問 {currentQuestionIndex + 1}/{questionRegions.length} | 
                表示 {visibleAnswers.size}/{answerSheets.length}
                {selectedAnswers.size > 0 && ` | 選択 ${selectedAnswers.size}`}
              </div>

              <div className="text-xs text-gray-500">
                詳細操作 →
              </div>
            </div>
          </div>

          {/* メインコンテンツ */}
          <div className="flex-1 flex overflow-hidden">
            {/* 採点エリア */}
            <div className="flex-1 p-6 overflow-hidden">
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
                  currentAnswerId={currentAnswerSheet?.id}
                  onEffectiveColumnsChange={setEffectiveColumns}
                />
              )}
            </div>

            {/* 右側サイドパネル */}
            {showSidePanel && (
              <div className="w-96 bg-gray-50 border-l border-gray-200 p-4 overflow-y-auto">
                {/* 設問ナビゲーター */}
                <QuestionNavigator
                  questionRegions={questionRegions}
                  currentQuestionIndex={currentQuestionIndex}
                  onQuestionChange={setCurrentQuestionIndex}
                  onPrevQuestion={handlePrevQuestion}
                  onNextQuestion={handleNextQuestion}
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
                />

                {/* プロジェクト進捗 */}
                <ProjectProgressCard
                  projectId={projectId}
                />
              </div>
            )}
          </div>
        </div>

        {/* 部分点入力モーダル */}
        <PartialScoreModal
          isOpen={showPartialScoreModal}
          value={partialScoreInput}
          maxPoints={currentQuestion?.points || 0}
          questionNumber={currentQuestion?.questionNumber || ""}
          onClose={handlePartialScoreCancel}
        />

        {/* 採点比較モーダル */}
        <ScoreComparisonModal
          isOpen={showScoreComparison}
          onClose={() => setShowScoreComparison(false)}
          answerSheetId={currentAnswerSheet?.id || ""}
          layoutRegionId={currentQuestion?.id || ""}
          questionNumber={currentQuestion?.questionNumber || ""}
          maxScore={currentQuestion?.points || 0}
          studentName={currentAnswerSheet ? `${currentAnswerSheet.student.lastName} ${currentAnswerSheet.student.firstName}` : ""}
        />
      </div>
    </>
  )
}