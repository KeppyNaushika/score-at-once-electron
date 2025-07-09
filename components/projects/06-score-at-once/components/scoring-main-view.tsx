"use client"

import LoadingSpinner from "@/components/common/LoadingSpinner"
import { usePageHelp } from "@/components/help/usePageHelp"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { LAYOUT_REAGION_AREA_TYPES } from "@/types/common.types"
import {
  ChevronLeft,
  Keyboard,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react"
import Head from "next/head"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import AnswerDisplayViewer from "../AnswerDisplayViewer"
import AnswerGridView from "../AnswerGridView"
import GradingModeToggle, { GradingMode } from "../GradingModeToggle"
import {
  getModifierKeyLabel,
  usePartialScore,
  useScoringData,
  useScoringFilter,
  useScoringKeyboard,
  useScoringNavigation,
} from "../hooks"
import ProjectProgressCard from "../ProjectProgressCard"
import ScoreComparisonModal from "../ScoreComparisonModal"
import NavigationControls from "./navigation-controls"
import PartialScoreModal from "./PartialScoreModal"
import QuestionNavigator from "./question-navigator"
import ScoringToolbar from "./scoring-toolbar"

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
  const [itemsPerRow, setItemsPerRow] = useState([5]) // 1行あたりの表示件数
  const [autoScroll, setAutoScroll] = useState(true) // 自動スクロール設定
  const [showStudentNames, setShowStudentNames] = useState(true) // 生徒名表示設定

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
  const [modifierKeyLabel, setModifierKeyLabel] = useState("Alt")

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
    onBatchScore: handleBatchScore,
    onAutoAdvance: handleAutoAdvance,
  })

  // 生徒名表示設定の変更をlocalStorageに保存
  const handleToggleStudentNames = useCallback(() => {
    setShowStudentNames((prev) => {
      const newValue = !prev
      localStorage.setItem(
        "answerGridView-showStudentNames",
        JSON.stringify(newValue),
      )
      return newValue
    })
  }, [])

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
    onToggleStudentNames: handleToggleStudentNames,
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
        const answersResult =
          await window.electronAPI.getAnswerSheetsByProjectId(projectId)
        if (!answersResult.success) {
          throw new Error(
            answersResult.error || "Failed to fetch answer sheets",
          )
        }

        // レイアウト領域（設問）データを取得
        const regionsResult =
          await window.electronAPI.getLayoutRegionsByProjectId(projectId)

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
        const transformedAnswerSheets = (answersResult.answerSheets || []).map(
          (sheet: any) => ({
            id: sheet.id,
            studentId: sheet.studentId,
            projectId: sheet.projectId,
            imagePath: sheet.originalImagePath || "",
            pageNumber: sheet.pageNumber || 1,
            status: sheet.status || "uploaded",
            student: sheet.student,
          }),
        )

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

  // localStorageから初期値を読み込み
  useEffect(() => {
    // 1行あたりの表示件数
    const storedItemsPerRow = localStorage.getItem("answerGridView-itemsPerRow")
    let initialValue = [5] // デフォルト値
    if (storedItemsPerRow) {
      try {
        const parsed = JSON.parse(storedItemsPerRow)
        if (
          Array.isArray(parsed) &&
          parsed.length === 1 &&
          typeof parsed[0] === "number" &&
          parsed[0] >= 1 &&
          parsed[0] <= 10
        ) {
          initialValue = parsed
          setItemsPerRow(parsed)
        }
      } catch (error) {
        console.warn("Failed to parse stored itemsPerRow:", error)
      }
    }
    // 実際の列数を更新
    setEffectiveColumns(initialValue[0])

    // 自動スクロール設定
    const storedAutoScroll = localStorage.getItem("answerGridView-autoScroll")
    if (storedAutoScroll !== null) {
      try {
        const parsed = JSON.parse(storedAutoScroll)
        if (typeof parsed === "boolean") {
          setAutoScroll(parsed)
        }
      } catch (error) {
        console.warn("Failed to parse stored autoScroll:", error)
      }
    }

    // 生徒名表示設定
    const storedShowNames = localStorage.getItem(
      "answerGridView-showStudentNames",
    )
    if (storedShowNames !== null) {
      try {
        const parsed = JSON.parse(storedShowNames)
        if (typeof parsed === "boolean") {
          setShowStudentNames(parsed)
        }
      } catch (error) {
        console.warn("Failed to parse stored showStudentNames:", error)
      }
    }
  }, [])

  // itemsPerRowの変更をlocalStorageに保存
  const handleItemsPerRowChange = (value: number[]) => {
    setItemsPerRow(value)
    localStorage.setItem("answerGridView-itemsPerRow", JSON.stringify(value))
    // 実際の列数を更新
    setEffectiveColumns(value[0])
  }

  // 自動スクロール設定の変更をlocalStorageに保存
  const handleAutoScrollChange = (enabled: boolean) => {
    setAutoScroll(enabled)
    localStorage.setItem("answerGridView-autoScroll", JSON.stringify(enabled))
  }

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

  // 自動進行機能付きのhandleBatchScore（ラッパー）
  const handleBatchScoreWithProgress = async (
    statusOrAnswerIds: any,
    statusOrPartialScore?: any,
    partialScore?: any,
  ) => {
    await handleBatchScore(
      statusOrAnswerIds,
      statusOrPartialScore,
      partialScore,
      selectedAnswers,
    )

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
    <>
      <Head>
        <title>{`採点 - ${project.examName}`}</title>
      </Head>

      <div
        className="grid h-full bg-gray-50"
        style={{
          gridTemplateAreas: '"header header" "content sidebar"',
          gridTemplateColumns: "1fr 384px",
          gridTemplateRows: "auto 1fr",
        }}
      >
        {/* ヘッダー */}
        <div
          className="border-b border-gray-200 bg-white px-6 py-4"
          style={{ gridArea: "header" }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/projects/${projectId}`)}
                className="text-gray-600"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                プロジェクト詳細
              </Button>
              <div className="text-lg font-semibold">{project.examName}</div>
              <div className="text-sm text-gray-500">
                {currentQuestion ? (
                  <>
                    {currentQuestion.questionNumber} ({currentQuestion.points}
                    点)
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
              <Dialog
                open={showKeyboardHelp}
                onOpenChange={setShowKeyboardHelp}
              >
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
                          <code className="rounded bg-gray-100 px-2 py-1">
                            Q
                          </code>
                        </div>
                        <div className="flex justify-between">
                          <span>正答</span>
                          <code className="rounded bg-gray-100 px-2 py-1">
                            E
                          </code>
                        </div>
                        <div className="flex justify-between">
                          <span>部分点</span>
                          <code className="rounded bg-gray-100 px-2 py-1">
                            F
                          </code>
                        </div>
                        <div className="flex justify-between">
                          <span>保留</span>
                          <code className="rounded bg-gray-100 px-2 py-1">
                            J
                          </code>
                        </div>
                        <div className="flex justify-between">
                          <span>誤答</span>
                          <code className="rounded bg-gray-100 px-2 py-1">
                            O
                          </code>
                        </div>
                        <div className="flex justify-between">
                          <span>無答</span>
                          <code className="rounded bg-gray-100 px-2 py-1">
                            P
                          </code>
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
                          <code className="rounded bg-gray-100 px-2 py-1">
                            R
                          </code>
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
          </div>

          {/* 簡潔な状態表示 */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              設問 {currentQuestionIndex + 1}/{questionRegions.length} | 表示{" "}
              {visibleAnswers.size}/{answerSheets.length}
              {selectedAnswers.size > 0 && ` | 選択 ${selectedAnswers.size}`}
            </div>

            <div className="text-xs text-gray-500">詳細操作 →</div>
          </div>
        </div>

        {/* 採点エリア */}
        <div
          className="min-h-0 min-w-0 p-6"
          style={{
            gridArea: "content",
            overflowX:
              layoutDirection === "down-right" ||
              layoutDirection === "down-left"
                ? "auto"
                : "hidden",
            overflowY:
              layoutDirection === "right-down" ||
              layoutDirection === "left-down"
                ? "auto"
                : "hidden",
          }}
        >
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
          <div
            className="overflow-y-auto border-l border-gray-200 bg-gray-50 p-4"
            style={{ gridArea: "sidebar" }}
          >
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
          questionNumber={currentQuestion?.questionNumber || ""}
          onClose={handlePartialScoreCancel}
          onChange={handlePartialScoreChange}
        />

        {/* 採点比較モーダル */}
        <ScoreComparisonModal
          isOpen={showScoreComparison}
          onClose={() => setShowScoreComparison(false)}
          answerSheetId={currentAnswerSheet?.id || ""}
          layoutRegionId={currentQuestion?.id || ""}
          questionNumber={currentQuestion?.questionNumber || ""}
          maxScore={currentQuestion?.points || 0}
          studentName={
            currentAnswerSheet
              ? `${currentAnswerSheet.student.lastName} ${currentAnswerSheet.student.firstName}`
              : ""
          }
        />
      </div>
    </>
  )
}
