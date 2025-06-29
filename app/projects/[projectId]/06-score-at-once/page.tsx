"use client"

import LoadingSpinner from "@/components/common/LoadingSpinner"
import AnswerDisplayViewer from "@/components/grading/AnswerDisplayViewer"
import AnswerGridView from "@/components/grading/AnswerGridView"
import GradingModeToggle, {
  GradingMode,
} from "@/components/grading/GradingModeToggle"
import ProjectProgressCard from "@/components/grading/ProjectProgressCard"
import ScoreComparisonModal from "@/components/grading/ScoreComparisonModal"
import { usePageHelp } from "@/components/help/usePageHelp"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { useParams, useRouter } from "next/navigation"
import Head from "next/head"
import { useCallback, useEffect, useRef, useState } from "react"
import type { QuestionScore } from "@prisma/client"
import { toast } from "sonner"

// 採点状態の型定義
type ScoringStatus =
  | "ungraded"
  | "correct"
  | "incorrect"
  | "partial"
  | "pending"
  | "no_answer"
  | "proposed"
  | "final"

// 採点データの型定義
interface ScoringData {
  id?: string
  questionId: string
  score: number
  maxScore: number
  status: ScoringStatus
  comment: string
  scoredByUserId: string
  version: number
  updatedAt: Date
}

// 答案の型定義
interface AnswerSheet {
  id: string
  studentId: string
  projectId: string
  imagePath: string
  pageNumber: number
  status: "uploaded" | "processing" | "ready" | "graded"
  student: {
    id: string
    studentId: string
    lastName: string
    firstName: string
    customOrder?: number // 受験生徒の表示順序
  }
}

// 設問領域の型定義
interface QuestionRegion {
  id: string
  label: string
  questionNumber: string
  points: number
  x: number
  y: number
  width: number
  height: number
  masterImageId: string // masterImageIdを追加
}

// キーボードショートカットの設定（Python版互換）
const DEFAULT_SHORTCUTS = {
  ungraded: "q", // 未採点
  correct: "e", // 正答
  partial: "f", // 部分点
  pending: "j", // 保留
  incorrect: "o", // 誤答
  no_answer: "p", // 無答
  nextQuestion: "ArrowRight",
  prevQuestion: "ArrowLeft",
  nextStudent: "ArrowDown",
  prevStudent: "ArrowUp",
  save: "ctrl+s",
  zoomIn: "=",
  zoomOut: "-",
  resetZoom: "0",
  fullView: "f",
}

export default function GradingPage() {
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
  
  // 表示フィルタリング状態
  const [displayFilter, setDisplayFilter] = useState<{
    ungraded: boolean
    correct: boolean
    incorrect: boolean
    partial: boolean
    pending: boolean
    no_answer: boolean
  }>({
    ungraded: true,
    correct: false,
    incorrect: false,
    partial: false,
    pending: false,
    no_answer: false
  })
  const [appliedFilter, setAppliedFilter] = useState<{
    ungraded: boolean
    correct: boolean
    incorrect: boolean
    partial: boolean
    pending: boolean
    no_answer: boolean
  }>({
    ungraded: true,
    correct: false,
    incorrect: false,
    partial: false,
    pending: false,
    no_answer: false
  })
  const [needsFilterRefresh, setNeedsFilterRefresh] = useState(false)
  const [filterUpdateKey, setFilterUpdateKey] = useState(0)
  
  // 部分点入力用状態
  const [partialScoreInput, setPartialScoreInput] = useState('')
  const [partialScoreInputTimer, setPartialScoreInputTimer] = useState<NodeJS.Timeout | null>(null)

  // 状態管理
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<any>(null)
  const [answerSheets, setAnswerSheets] = useState<AnswerSheet[]>([])
  const [questionRegions, setQuestionRegions] = useState<QuestionRegion[]>([])
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [scoringData, setScoringData] = useState<Record<string, ScoringData>>(
    {},
  )
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false)
  const [showScoreComparison, setShowScoreComparison] = useState(false)
  const [imageZoom, setImageZoom] = useState(1.0)
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 })
  const [viewMode, setViewMode] = useState<"question" | "full">("question") // 設問拡大 or 全体表示
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showSidePanel, setShowSidePanel] = useState(true) // サイドパネルの表示制御

  // Refs
  const imageRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // 現在の答案と設問
  const currentAnswerSheet = answerSheets[currentStudentIndex]
  const currentQuestion = questionRegions[currentQuestionIndex]

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
          // デフォルトユーザーを作成または取得する処理をここに追加可能
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

        // 設問領域のみをフィルタリング - regionsResult is an array directly
        const questionRegions = (
          Array.isArray(regionsResult) ? regionsResult : []
        )
          .filter(
            (region: any) =>
              region.type === "QUESTION_ANSWER" && region.questionNumber,
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
            masterImageId: region.masterImageId, // masterImageIdを追加
          }))

        // 既存の採点データを取得
        const existingScores = await loadExistingScoringData(projectId)

        // Transform the data to match AnswerSheet interface
        const transformedAnswerSheets = (answersResult.answerSheets || []).map(
          (sheet: any) => {
            console.log('Student data:', sheet.student) // デバッグログ
            return {
              id: sheet.id,
              studentId: sheet.studentId,
              projectId: sheet.projectId,
              imagePath: sheet.originalImagePath || "",
              pageNumber: sheet.pageNumber || 1,
              status: sheet.status || "uploaded",
              student: sheet.student,
            }
          }
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
  }, [projectId])

  // displayFilterとappliedFilterの初期同期
  useEffect(() => {
    setAppliedFilter(displayFilter)
  }, [])

  // 最初の答案を初期選択状態にする（appliedFilterに基づく）
  useEffect(() => {
    if (gradingMode === "grid" && answerSheets.length > 0) {
      const filteredAnswers = getGridAnswerData()
      if (filteredAnswers.length > 0 && selectedAnswers.size === 0) {
        setSelectedAnswers(new Set([filteredAnswers[0].id]))
      }
    }
  }, [gradingMode, answerSheets.length, currentQuestionIndex, filterUpdateKey])

  // 設問変更時に選択状態をリセット（ナビゲーション再読み込みを避ける）
  useEffect(() => {
    if (gradingMode === "grid") {
      setSelectedAnswers(new Set())
      // 設問変更時は自動選択しない（手動でWASD移動またはクリックで選択）
    }
  }, [currentQuestionIndex])

  // 既存の採点データを読み込む関数
  const loadExistingScoringData = async (
    projectId: string,
  ): Promise<Record<string, ScoringData>> => {
    try {
      const scores = await window.electronAPI.getQuestionScoresForProject(projectId)
      if (!scores || !Array.isArray(scores)) return {}

      const scoringData: Record<string, ScoringData> = {}
      scores.forEach((score: QuestionScore) => {
        const key = `${score.answerSheetId}-${score.layoutRegionId}`
        scoringData[key] = {
          id: score.id,
          questionId: score.layoutRegionId,
          score: score.score || 0,
          maxScore: 0, // We'll need to get this from the layout region
          status: score.status as ScoringStatus,
          comment: score.comment || "",
          scoredByUserId: score.scoredByUserId,
          version: score.scoreVersion || 0,
          updatedAt: new Date(score.updatedAt),
        }
      })

      return scoringData
    } catch (error) {
      console.error("Failed to load existing scoring data:", error)
      return {}
    }
  }

  // キーボードイベントハンドラー
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      // 入力フィールドがフォーカスされている場合はスキップ
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      // グリッドモードでの特殊キーハンドリング
      if (gradingMode === "grid") {
        const key = event.key.toLowerCase()
        
        // Alt+採点キーでフィルタ切り替え
        if (event.altKey && [DEFAULT_SHORTCUTS.ungraded, DEFAULT_SHORTCUTS.correct, DEFAULT_SHORTCUTS.incorrect, DEFAULT_SHORTCUTS.partial, DEFAULT_SHORTCUTS.pending, DEFAULT_SHORTCUTS.no_answer].includes(key)) {
          event.preventDefault()
          handleToggleFilterByScoreKey(key)
          return
        }
        
        // WASD移動の処理
        if (['w', 'a', 's', 'd'].includes(key)) {
          event.preventDefault()
          handleGridNavigation(key)
          return
        }
        
        // Rキーでフィルタを更新
        if (key === 'r') {
          event.preventDefault()
          handleRefreshFilter()
          return
        }
        
        // 数字キーで部分点入力（選択されている答案がある場合）
        if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(key) && selectedAnswers.size > 0) {
          event.preventDefault()
          handlePartialScoreInput(key)
          return
        }
        
        // Backspaceで部分点をnullに設定
        if (key === 'backspace' && selectedAnswers.size > 0) {
          event.preventDefault()
          handlePartialScoreReset()
          return
        }
        
        // 採点キー（Alt無し）で通常の採点
        if ([DEFAULT_SHORTCUTS.ungraded, DEFAULT_SHORTCUTS.correct, DEFAULT_SHORTCUTS.incorrect, DEFAULT_SHORTCUTS.partial, DEFAULT_SHORTCUTS.pending, DEFAULT_SHORTCUTS.no_answer].includes(key) && selectedAnswers.size > 0) {
          event.preventDefault()
          handleBatchScore(key as ScoringStatus)
          return
        }
        
        // グリッドモードではその他のキーはグリッドコンポーネントに委譲
        return
      }

      // 個別採点モードのキーボード処理
      const key = event.key.toLowerCase()
      switch (key) {
        case DEFAULT_SHORTCUTS.ungraded:
          event.preventDefault()
          handleSetScore("ungraded")
          break
        case DEFAULT_SHORTCUTS.correct:
          event.preventDefault()
          handleSetScore("correct")
          break
        case DEFAULT_SHORTCUTS.partial:
          event.preventDefault()
          handleSetScore("partial")
          break
        case DEFAULT_SHORTCUTS.pending:
          event.preventDefault()
          handleSetScore("pending")
          break
        case DEFAULT_SHORTCUTS.incorrect:
          event.preventDefault()
          handleSetScore("incorrect")
          break
        case DEFAULT_SHORTCUTS.no_answer:
          event.preventDefault()
          handleSetScore("no_answer")
          break
        case "ArrowRight":
          event.preventDefault()
          handleNextQuestion()
          break
        case "ArrowLeft":
          event.preventDefault()
          handlePrevQuestion()
          break
        case "ArrowDown":
          event.preventDefault()
          handleNextStudent()
          break
        case "ArrowUp":
          event.preventDefault()
          handlePrevStudent()
          break
        case DEFAULT_SHORTCUTS.zoomIn:
          event.preventDefault()
          handleZoomIn()
          break
        case DEFAULT_SHORTCUTS.zoomOut:
          event.preventDefault()
          handleZoomOut()
          break
        case DEFAULT_SHORTCUTS.resetZoom:
          event.preventDefault()
          handleResetZoom()
          break
        case DEFAULT_SHORTCUTS.fullView:
          event.preventDefault()
          toggleViewMode()
          break
      }
    },
    [
      gradingMode,
      currentStudentIndex,
      currentQuestionIndex,
      answerSheets.length,
      questionRegions.length,
    ],
  )

  // キーボードイベントリスナーの設定
  useEffect(() => {
    document.addEventListener("keydown", handleKeyPress)
    return () => document.removeEventListener("keydown", handleKeyPress)
  }, [handleKeyPress])

  // ナビゲーション関数
  const handleNextQuestion = () => {
    if (currentQuestionIndex < questionRegions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
    }
  }

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1)
    }
  }

  const handleNextStudent = () => {
    if (currentStudentIndex < answerSheets.length - 1) {
      setCurrentStudentIndex(currentStudentIndex + 1)
    }
  }

  const handlePrevStudent = () => {
    if (currentStudentIndex > 0) {
      setCurrentStudentIndex(currentStudentIndex - 1)
    }
  }

  // 採点処理関数
  const handleSetScore = async (
    type: ScoringStatus,
  ) => {
    if (!currentAnswerSheet || !currentQuestion || !currentUserId) {
      if (!currentUserId) {
        alert("ユーザー情報の取得中です。しばらくお待ちください。")
      }
      return
    }

    const key = `${currentAnswerSheet.id}-${currentQuestion.id}`
    const currentScore = scoringData[key]

    let newScore = 0
    // In collaborative mode, new scores should be "proposed"
    let status: ScoringStatus = type === "ungraded" ? "ungraded" : "proposed"

    switch (type) {
      case "ungraded":
        newScore = 0
        status = "ungraded"
        break
      case "correct":
        newScore = currentQuestion.points
        break
      case "incorrect":
        newScore = 0
        break
      case "no_answer":
        newScore = 0
        break
      case "partial":
        // 部分点の場合は入力ダイアログを表示（簡易実装）
        const inputScore = prompt(
          `部分点を入力してください (0-${currentQuestion.points}):`,
          currentScore?.score.toString() || "0",
        )
        if (inputScore === null) return
        const parsedScore = parseInt(inputScore)
        if (
          isNaN(parsedScore) ||
          parsedScore < 0 ||
          parsedScore > currentQuestion.points
        ) {
          alert("無効な点数です")
          return
        }
        newScore = parsedScore
        break
      case "pending":
        newScore = currentScore?.score || 0
        break
    }

    // Save to database immediately
    try {
      if (currentScore?.id) {
        // Update existing score
        const result = await window.electronAPI.updateQuestionScore(
          currentScore.id,
          {
            score: newScore,
            status,
            comment: currentScore.comment || "",
          },
          currentScore.version,
        )

        if ((result as any).success || result.scoreVersion) {
          setScoringData((prev) => ({
            ...prev,
            [key]: {
              ...currentScore,
              score: newScore,
              status,
              version: (result as any).score?.scoreVersion || result.scoreVersion,
              updatedAt: new Date((result as any).score?.updatedAt || result.updatedAt),
            },
          }))
          
          // 個別採点モードの場合、採点後に自動的に次の答案に移動
          if (gradingMode === "individual" && type !== "ungraded") {
            setTimeout(() => {
              if (currentStudentIndex < answerSheets.length - 1) {
                setCurrentStudentIndex(currentStudentIndex + 1)
              } else {
                // 最後の生徒の場合、次の設問の最初の生徒に移動
                if (currentQuestionIndex < questionRegions.length - 1) {
                  setCurrentQuestionIndex(currentQuestionIndex + 1)
                  setCurrentStudentIndex(0)
                }
              }
            }, 300) // 300ms後に移動（採点状態を確認する時間を与える）
          }
        } else {
          console.error("Failed to update score:", (result as any).error)
          alert("採点の保存に失敗しました: " + (result as any).error)
        }
      } else {
        // Create new score
        const result = await window.electronAPI.createQuestionScore({
          answerSheetId: currentAnswerSheet.id,
          layoutRegionId: currentQuestion.id,
          score: newScore,
          status,
          comment: "",
          scoredByUserId: currentUserId,
        } as any)

        if ((result as any).success || result.id) {
          setScoringData((prev) => ({
            ...prev,
            [key]: {
              id: (result as any).score?.id || result.id,
              questionId: currentQuestion.id,
              score: newScore,
              maxScore: currentQuestion.points,
              status,
              comment: "",
              scoredByUserId: currentUserId,
              version: (result as any).score?.scoreVersion || result.scoreVersion,
              updatedAt: new Date((result as any).score?.updatedAt || result.updatedAt),
            },
          }))
          
          // 個別採点モードの場合、採点後に自動的に次の答案に移動
          if (gradingMode === "individual" && type !== "ungraded") {
            setTimeout(() => {
              if (currentStudentIndex < answerSheets.length - 1) {
                setCurrentStudentIndex(currentStudentIndex + 1)
              } else {
                // 最後の生徒の場合、次の設問の最初の生徒に移動
                if (currentQuestionIndex < questionRegions.length - 1) {
                  setCurrentQuestionIndex(currentQuestionIndex + 1)
                  setCurrentStudentIndex(0)
                }
              }
            }, 300) // 300ms後に移動（採点状態を確認する時間を与える）
          }
        } else {
          console.error("Failed to create score:", (result as any).error)
          alert("採点の保存に失敗しました: " + ((result as any).error || "不明なエラー"))
        }
      }

      // Check for auto-finalization in collaborative mode
      if (status === "proposed") {
        await checkForAutoFinalization(currentAnswerSheet.id, currentQuestion.id)
      }
    } catch (error) {
      console.error("Error in scoring:", error)
      alert("採点中にエラーが発生しました")
    }
  }

  // Auto-finalization logic for collaborative grading
  const checkForAutoFinalization = async (answerSheetId: string, layoutRegionId: string) => {
    if (!currentUserId) return

    try {
      const comparison = await window.electronAPI.getQuestionScoreComparison(answerSheetId, layoutRegionId)
      
      if ((comparison as any).success && (comparison as any).proposedScores && (comparison as any).proposedScores.length > 1) {
        // Check if all proposed scores are identical
        const firstScore = (comparison as any).proposedScores[0]
        const allMatch = (comparison as any).proposedScores.every((score: any) => 
          score.score === firstScore.score && 
          score.status === firstScore.status
        )
        
        if (allMatch) {
          // Auto-finalize if all scores match
          const result = await window.electronAPI.finalizeQuestionScore(
            answerSheetId, 
            layoutRegionId, 
            currentUserId,
            { 
              score: firstScore.score, 
              comment: firstScore.comment || "" 
            } as any
          )
          
          if ((result as any).success) {
            // Update local scoring data to reflect finalization
            const key = `${answerSheetId}-${layoutRegionId}`
            setScoringData((prev) => ({
              ...prev,
              [key]: {
                ...prev[key],
                status: "final",
                version: (result as any).score?.scoreVersion || (result as any).scoreVersion,
                updatedAt: new Date((result as any).score?.updatedAt || (result as any).updatedAt),
              },
            }))
          }
        }
      }
    } catch (error) {
      console.error("Error in auto-finalization:", error)
    }
  }

  // 画像表示関連の関数
  const handleZoomIn = () => {
    setImageZoom((prev) => Math.min(prev * 1.2, 5.0))
  }

  const handleZoomOut = () => {
    setImageZoom((prev) => Math.max(prev / 1.2, 0.1))
  }

  const handleResetZoom = () => {
    setImageZoom(1.0)
    setImagePosition({ x: 0, y: 0 })
  }

  const toggleViewMode = () => {
    setViewMode((prev) => (prev === "question" ? "full" : "question"))
    handleResetZoom()
  }

  // グリッドビュー用のヘルパー関数
  const handleAnswerSelect = (answerId: string, isSelected: boolean) => {
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

  // オーバーロード用のhandleBatchScore関数（部分点指定可能）
  const handleBatchScore = async (
    statusOrAnswerIds: ScoringStatus | string | string[],
    statusOrPartialScore?: ScoringStatus | number | null,
    partialScore?: number | null
  ) => {
    // 引数の解析
    let answerIds: string | string[]
    let status: ScoringStatus
    let scoreValue: number | null = null

    if (typeof statusOrAnswerIds === 'string' && !Array.isArray(statusOrAnswerIds) && ['ungraded', 'correct', 'incorrect', 'partial', 'pending', 'no_answer'].includes(statusOrAnswerIds)) {
      // 新形式: handleBatchScore(status, partialScore?)
      status = statusOrAnswerIds as ScoringStatus
      answerIds = Array.from(selectedAnswers)
      scoreValue = typeof statusOrPartialScore === 'number' ? statusOrPartialScore : null
    } else {
      // 旧形式: handleBatchScore(answerIds, status)
      answerIds = statusOrAnswerIds as string | string[]
      status = statusOrPartialScore as ScoringStatus
      scoreValue = partialScore || null
    }
    if (!currentUserId) {
      alert("ユーザー情報の取得中です。しばらくお待ちください。")
      return
    }

    const ids = Array.isArray(answerIds) ? answerIds : [answerIds]

    for (const answerId of ids) {
      const answerSheet = answerSheets.find((sheet) => sheet.id === answerId)
      if (!answerSheet || !currentQuestion) continue

      const key = `${answerId}-${currentQuestion.id}`
      const currentScore = scoringData[key]

      let newScore = 0
      // In collaborative mode, new scores should be "proposed"
      let scoringStatus: ScoringStatus = status === "ungraded" ? "ungraded" : "proposed"

      switch (status) {
        case "ungraded":
          newScore = 0
          scoringStatus = "ungraded"
          break
        case "correct":
          newScore = currentQuestion.points
          break
        case "incorrect":
        case "no_answer":
          newScore = 0
          break
        case "partial":
          // 指定された部分点を使用、なければ満点の半分を設定
          if (scoreValue !== null && scoreValue !== undefined) {
            newScore = scoreValue
          } else {
            newScore = Math.floor(currentQuestion.points / 2)
          }
          break
        case "pending":
          newScore = currentScore?.score || 0
          break
      }

      // Save to database via API
      try {
        if (currentScore?.id) {
          // Update existing score
          const result = await window.electronAPI.updateQuestionScore(
            currentScore.id,
            {
              score: newScore,
              status: scoringStatus,
              comment: currentScore.comment || "",
            } as any,
            currentScore.version,
          )

          if ((result as any).success || result.id) {
            setScoringData((prev) => ({
              ...prev,
              [key]: {
                ...currentScore,
                score: newScore,
                status: scoringStatus,
                version: (result as any).score?.scoreVersion || (result as any).scoreVersion,
                updatedAt: new Date((result as any).score?.updatedAt || (result as any).updatedAt),
              },
            }))
          } else {
            console.error("Failed to update batch score:", (result as any).error)
            toast.error(`採点データの更新に失敗しました: ${(result as any).error || JSON.stringify(result)}`)
          }
        } else {
          // Create new score
          const result = await window.electronAPI.createQuestionScore({
            answerSheetId: answerId,
            layoutRegionId: currentQuestion.id,
            score: newScore,
            status: scoringStatus,
            comment: "",
            scoredByUserId: currentUserId,
          } as any)

          if (result && result.id) {
            setScoringData((prev) => ({
              ...prev,
              [key]: {
                id: (result as any).score?.id || result.id,
                questionId: currentQuestion.id,
                score: newScore,
                maxScore: currentQuestion.points,
                status: scoringStatus,
                comment: "",
                scoredByUserId: currentUserId,
                version: (result as any).score?.scoreVersion || (result as any).scoreVersion,
                updatedAt: new Date((result as any).score?.updatedAt || (result as any).updatedAt),
              },
            }))
          } else {
            console.error("Failed to create batch score:", result)
            toast.error(`採点データの作成に失敗しました: ${JSON.stringify(result)}`)
          }
        }
      } catch (error) {
        console.error("Error in batch scoring:", error)
      }
    }

    // 採点後の自動次答案選択（一覧採点モード用）
    if (gradingMode === "grid" && selectedAnswers.size === 1) {
      const currentSelectedId = Array.from(selectedAnswers)[0]
      const gridAnswers = getGridAnswerData()
      const currentIndex = gridAnswers.findIndex(answer => answer.id === currentSelectedId)
      
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
    
    // 採点後はフィルタ更新が必要であることを示すが、即座には更新しない
    // setNeedsFilterRefresh(true) // コメントアウトして即時更新を防止
  }

  // 基本的なグリッドデータ取得（フィルタリングなし）
  const getAllGridAnswerData = () => {
    if (!currentQuestion) return []

    // masterImageIdに基づいてmasterImageのpageNumberを取得
    const masterImage = project?.masterImages?.find((img: any) => img.id === currentQuestion.masterImageId)
    const targetPageNumber = masterImage?.pageNumber || 1

    // pageNumberでフィルタリングしてから受験生徒順でソート
    const pageFilteredSheets = answerSheets.filter(sheet => sheet.pageNumber === targetPageNumber)
    
    const sortedAnswerSheets = [...pageFilteredSheets].sort((a, b) => {
      // ProjectStudentのcustomOrderで並び替え（小さい値が先）
      // customOrderが未定義の場合は、学籍番号の数値として比較
      const aOrder = a.student.customOrder !== undefined ? a.student.customOrder : 999999
      const bOrder = b.student.customOrder !== undefined ? b.student.customOrder : 999999
      
      // customOrderが同じ場合は姓名でソート
      if (aOrder === bOrder) {
        const aName = `${a.student.lastName}${a.student.firstName}`
        const bName = `${b.student.lastName}${b.student.firstName}`
        return aName.localeCompare(bName, 'ja')
      }
      
      return aOrder - bOrder
    })

    return sortedAnswerSheets.map((sheet) => {
      const key = `${sheet.id}-${currentQuestion.id}`
      const scoreData = scoringData[key]

      return {
        id: sheet.id,
        studentId: sheet.student.studentId,
        studentName: `${sheet.student.lastName} ${sheet.student.firstName}`,
        imageUrl: `appimg://${sheet.imagePath}`,
        currentScore: scoreData?.score,
        maxScore: currentQuestion.points,
        status: (scoreData?.status || "ungraded") as ScoringStatus,
        isSelected: selectedAnswers.has(sheet.id),
        questionRegion: currentQuestion, // 採点領域情報を追加
      }
    })
  }

  // フィルタリングされたグリッドデータ取得（appliedFilterを使用）
  const getFilteredGridAnswerData = () => {
    const allAnswers = getAllGridAnswerData()
    const filteredAnswers = allAnswers.filter(answer => appliedFilter[answer.status as keyof typeof appliedFilter])
    console.log('Filter Debug:', {
      allAnswersCount: allAnswers.length,
      filteredCount: filteredAnswers.length,
      appliedFilter,
      statuses: allAnswers.map(a => a.status)
    })
    return filteredAnswers
  }

  // 表示用のグリッドデータ（フィルタリング適用）
  const getGridAnswerData = () => {
    return getFilteredGridAnswerData()
  }

  // displayFilterとappliedFilterが同期しているかチェック
  const isFilterSynced = () => {
    return JSON.stringify(displayFilter) === JSON.stringify(appliedFilter)
  }

  // フィルタリング関連ハンドラー（手動リフレッシュ用、Rキー）
  const handleRefreshFilter = () => {
    const newAppliedFilter = {...displayFilter}
    setAppliedFilter(newAppliedFilter)
    setNeedsFilterRefresh(false)
    setFilterUpdateKey(prev => prev + 1) // 強制的に再レンダリング
    // 選択状態をリセット
    setSelectedAnswers(new Set())
    // フィルタ適用後の最初の答案を選択
    setTimeout(() => {
      const allAnswers = getAllGridAnswerData()
      const filteredAnswers = allAnswers.filter(answer => newAppliedFilter[answer.status as keyof typeof newAppliedFilter])
      if (filteredAnswers.length > 0) {
        setSelectedAnswers(new Set([filteredAnswers[0].id]))
      }
    }, 100)
  }

  const handleToggleFilter = (key: string) => {
    const filterMap: { [key: string]: keyof typeof displayFilter } = {
      '1': 'ungraded',
      '2': 'correct', 
      '3': 'incorrect',
      '4': 'partial',
      '5': 'pending',
      '6': 'no_answer'
    }
    
    const filterKey = filterMap[key]
    if (filterKey) {
      const newDisplayFilter = {
        ...displayFilter,
        [filterKey]: !displayFilter[filterKey]
      }
      setDisplayFilter(newDisplayFilter)
      
      // 即座にappliedFilterも更新
      setAppliedFilter(newDisplayFilter)
      setFilterUpdateKey(prev => prev + 1) // 強制再レンダリング
      setNeedsFilterRefresh(false) // リフレッシュが不要になったことを示す
      
      // 選択状態をリセット
      setSelectedAnswers(new Set())
      
      // フィルタ適用後の最初の答案を選択
      setTimeout(() => {
        const allAnswers = getAllGridAnswerData()
        const filteredAnswers = allAnswers.filter(answer => newDisplayFilter[answer.status as keyof typeof newDisplayFilter])
        if (filteredAnswers.length > 0) {
          setSelectedAnswers(new Set([filteredAnswers[0].id]))
        }
      }, 100)
    }
  }

  // Alt+採点キーでフィルタ切り替え
  const handleToggleFilterByScoreKey = (scoreKey: string) => {
    const scoreToFilterMap: { [key: string]: keyof typeof displayFilter } = {
      [DEFAULT_SHORTCUTS.ungraded]: 'ungraded',
      [DEFAULT_SHORTCUTS.correct]: 'correct',
      [DEFAULT_SHORTCUTS.incorrect]: 'incorrect', 
      [DEFAULT_SHORTCUTS.partial]: 'partial',
      [DEFAULT_SHORTCUTS.pending]: 'pending',
      [DEFAULT_SHORTCUTS.no_answer]: 'no_answer'
    }
    
    const filterKey = scoreToFilterMap[scoreKey]
    if (filterKey) {
      const newDisplayFilter = {
        ...displayFilter,
        [filterKey]: !displayFilter[filterKey]
      }
      setDisplayFilter(newDisplayFilter)
      
      // 即座にappliedFilterも更新
      setAppliedFilter(newDisplayFilter)
      setFilterUpdateKey(prev => prev + 1) // 強制再レンダリング
      setNeedsFilterRefresh(false) // リフレッシュが不要になったことを示す
      
      // 選択状態をリセット
      setSelectedAnswers(new Set())
      // フィルタ適用後の最初の答案を選択
      setTimeout(() => {
        const allAnswers = getAllGridAnswerData()
        const filteredAnswers = allAnswers.filter(answer => newDisplayFilter[answer.status as keyof typeof newDisplayFilter])
        if (filteredAnswers.length > 0) {
          setSelectedAnswers(new Set([filteredAnswers[0].id]))
        }
      }, 100)
    }
  }

  // 部分点入力処理
  const handlePartialScoreInput = async (digit: string) => {
    if (selectedAnswers.size === 0 || !currentQuestion) return
    
    // 現在の部分点入力状態を管理
    const currentPartialInput = partialScoreInput || ''
    const newPartialInput = currentPartialInput + digit
    
    // 数値として有効かチェック（最大点数以下）
    const numericValue = parseFloat(newPartialInput)
    const maxPoints = currentQuestion.points || 10
    if (isNaN(numericValue) || numericValue > maxPoints) {
      return // 無効な入力は無視
    }
    
    setPartialScoreInput(newPartialInput)
    
    // 一定時間後に自動的に採点を実行
    if (partialScoreInputTimer) {
      clearTimeout(partialScoreInputTimer)
    }
    
    const timer = setTimeout(() => {
      if (partialScoreInput === newPartialInput) { // 入力が変更されていない場合のみ
        handleBatchScore('partial' as ScoringStatus, numericValue)
        setPartialScoreInput('')
      }
    }, 1500) // 1.5秒待機
    
    setPartialScoreInputTimer(timer)
  }

  // 部分点リセット処理
  const handlePartialScoreReset = () => {
    if (selectedAnswers.size === 0) return
    
    setPartialScoreInput('')
    if (partialScoreInputTimer) {
      clearTimeout(partialScoreInputTimer)
      setPartialScoreInputTimer(null)
    }
    handleBatchScore('partial' as ScoringStatus, null)
  }

  // WASD移動ハンドラー（レイアウト方向とフィルタリングに対応）
  const handleGridNavigation = (key: string) => {
    if (answerSheets.length === 0) return
    
    const gridAnswers = getGridAnswerData()
    const totalAnswers = gridAnswers.length
    
    if (totalAnswers === 0) return
    
    const cols = Math.max(1, gridSize.columns) // 最低1列は確保
    const rows = Math.ceil(totalAnswers / cols)
    
    // 現在選択されている答案のインデックスを取得
    let currentIndex = -1
    if (selectedAnswers.size >= 1) {
      const selectedId = Array.from(selectedAnswers)[0]
      currentIndex = gridAnswers.findIndex(answer => answer.id === selectedId)
    }
    
    // 何も選択されていない場合は最初の答案を選択
    if (currentIndex === -1) {
      if (totalAnswers > 0) {
        setSelectedAnswers(new Set([gridAnswers[0].id]))
      }
      return
    }
    
    let newIndex = currentIndex
    
    // デバッグ情報（開発時のみ）
    console.log('WASD Navigation:', {
      key,
      currentIndex,
      totalAnswers,
      cols,
      rows,
      layoutDirection,
      selectedAnswerIds: Array.from(selectedAnswers)
    })
    
    // レイアウト方向に応じて移動ロジックを分ける
    if (layoutDirection === "down-right" || layoutDirection === "down-left") {
      // 縦方向優先レイアウト（縦に並んでから横に進む）
      const actualCols = Math.ceil(totalAnswers / rows)
      const currentCol = Math.floor(currentIndex / rows)
      const currentRow = currentIndex % rows
      
      switch (key) {
        case 'w': // 上
          if (currentRow > 0) {
            newIndex = currentCol * rows + (currentRow - 1)
          } else if (currentCol > 0) {
            // 上端の場合、前の列の最下行に移動
            const prevColLastIndex = (currentCol - 1) * rows + Math.min(rows - 1, totalAnswers - (currentCol - 1) * rows - 1)
            if (prevColLastIndex >= 0 && prevColLastIndex < totalAnswers) {
              newIndex = prevColLastIndex
            }
          }
          break
        case 's': // 下
          if (currentRow < rows - 1) {
            const nextRowIndex = currentCol * rows + (currentRow + 1)
            if (nextRowIndex < totalAnswers) {
              newIndex = nextRowIndex
            }
          } else if (currentCol < actualCols - 1) {
            // 下端の場合、次の列の最上行に移動
            const nextColFirstIndex = (currentCol + 1) * rows
            if (nextColFirstIndex < totalAnswers) {
              newIndex = nextColFirstIndex
            }
          }
          break
        case 'a': // 左
          if (layoutDirection === "down-right") {
            // down-rightでは左に移動
            if (currentCol > 0) {
              const leftIndex = (currentCol - 1) * rows + Math.min(currentRow, Math.max(0, totalAnswers - (currentCol - 1) * rows - 1))
              if (leftIndex >= 0 && leftIndex < totalAnswers) {
                newIndex = leftIndex
              }
            }
          } else {
            // down-leftでは右に移動（逆方向）
            if (currentCol < actualCols - 1) {
              const rightIndex = (currentCol + 1) * rows + Math.min(currentRow, Math.max(0, totalAnswers - (currentCol + 1) * rows - 1))
              if (rightIndex >= 0 && rightIndex < totalAnswers) {
                newIndex = rightIndex
              }
            }
          }
          break
        case 'd': // 右
          if (layoutDirection === "down-right") {
            // down-rightでは右に移動
            if (currentCol < actualCols - 1) {
              const rightIndex = (currentCol + 1) * rows + Math.min(currentRow, Math.max(0, totalAnswers - (currentCol + 1) * rows - 1))
              if (rightIndex >= 0 && rightIndex < totalAnswers) {
                newIndex = rightIndex
              }
            }
          } else {
            // down-leftでは左に移動（逆方向）
            if (currentCol > 0) {
              const leftIndex = (currentCol - 1) * rows + Math.min(currentRow, Math.max(0, totalAnswers - (currentCol - 1) * rows - 1))
              if (leftIndex >= 0 && leftIndex < totalAnswers) {
                newIndex = leftIndex
              }
            }
          }
          break
      }
    } else {
      // 横方向優先レイアウト（横に並んでから縦に進む）
      const currentRow = Math.floor(currentIndex / cols)
      const currentCol = currentIndex % cols
      
      switch (key) {
        case 'w': // 上
          if (currentRow > 0) {
            newIndex = (currentRow - 1) * cols + currentCol
          }
          break
        case 's': // 下
          if (currentRow < rows - 1) {
            const nextRowIndex = (currentRow + 1) * cols + currentCol
            if (nextRowIndex < totalAnswers) {
              newIndex = nextRowIndex
            }
          }
          break
        case 'a': // 左
          if (layoutDirection === "right-down") {
            // right-downでは左に移動
            if (currentCol > 0) {
              newIndex = currentIndex - 1
            } else if (currentRow > 0) {
              // 左端の場合、前の行の最右端に移動
              const prevRowLastIndex = (currentRow - 1) * cols + Math.min(cols - 1, totalAnswers - (currentRow - 1) * cols - 1)
              if (prevRowLastIndex >= 0 && prevRowLastIndex < totalAnswers) {
                newIndex = prevRowLastIndex
              }
            }
          } else {
            // left-downでは右に移動（逆方向）
            if (currentCol < cols - 1 && currentIndex + 1 < totalAnswers) {
              newIndex = currentIndex + 1
            } else if (currentRow < rows - 1) {
              // 右端の場合、次の行の最左端に移動
              const nextRowFirstIndex = (currentRow + 1) * cols
              if (nextRowFirstIndex < totalAnswers) {
                newIndex = nextRowFirstIndex
              }
            }
          }
          break
        case 'd': // 右
          if (layoutDirection === "right-down") {
            // right-downでは右に移動
            if (currentCol < cols - 1 && currentIndex + 1 < totalAnswers) {
              newIndex = currentIndex + 1
            } else if (currentRow < rows - 1) {
              // 右端の場合、次の行の最左端に移動
              const nextRowFirstIndex = (currentRow + 1) * cols
              if (nextRowFirstIndex < totalAnswers) {
                newIndex = nextRowFirstIndex
              }
            }
          } else {
            // left-downでは左に移動（逆方向）
            if (currentCol > 0) {
              newIndex = currentIndex - 1
            } else if (currentRow > 0) {
              // 左端の場合、前の行の最右端に移動
              const prevRowLastIndex = (currentRow - 1) * cols + Math.min(cols - 1, totalAnswers - (currentRow - 1) * cols - 1)
              if (prevRowLastIndex >= 0 && prevRowLastIndex < totalAnswers) {
                newIndex = prevRowLastIndex
              }
            }
          }
          break
      }
    }
    
    // 新しいインデックスが有効な場合のみ選択を更新
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < totalAnswers) {
      const newSelectedId = gridAnswers[newIndex].id
      setSelectedAnswers(new Set([newSelectedId]))
      
      // デバッグ情報（開発時のみ）
      console.log('WASD Navigation Result:', {
        oldIndex: currentIndex,
        newIndex,
        oldId: gridAnswers[currentIndex]?.id,
        newId: newSelectedId,
        success: true
      })
    } else {
      // 移動できなかった場合のデバッグ情報
      console.log('WASD Navigation Failed:', {
        currentIndex,
        attemptedNewIndex: newIndex,
        totalAnswers,
        reason: newIndex === currentIndex ? 'Same index' : 'Out of bounds'
      })
    }
  }


  // 採点データ保存
  // 採点レコード初期化
  const handleInitializeScoringRecords = async () => {
    const confirmed = confirm(
      "すべての採点データを初期化します。\n既存の採点結果は失われますが、よろしいですか？"
    )
    if (!confirmed) return

    try {
      const result = await window.electronAPI.initializeScoringRecords(projectId)
      if (result.success) {
        alert(`採点レコードを初期化しました（${result.initialized}件）`)
        // 採点データを再読み込み
        const existingScores = await loadExistingScoringData(projectId)
        setScoringData(existingScores)
      } else {
        alert("採点レコードの初期化に失敗しました: " + result.error)
      }
    } catch (error) {
      console.error("Failed to initialize scoring records:", error)
      alert("採点レコードの初期化中にエラーが発生しました")
    }
  }


  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (answerSheets.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4">
        <FileText className="text-muted-foreground h-12 w-12" />
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold">答案がありません</h2>
          <p className="text-muted-foreground mb-4">
            採点を開始するには、まず答案をアップロードしてください。
          </p>
          <Button
            onClick={() =>
              router.push(`/projects/${projectId}/05-answer-sheets`)
            }
          >
            答案管理へ移動
          </Button>
        </div>
      </div>
    )
  }

  if (questionRegions.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center space-y-4">
        <Settings className="text-muted-foreground h-12 w-12" />
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold">
            採点領域が設定されていません
          </h2>
          <p className="text-muted-foreground mb-4">
            採点を開始するには、まず採点領域を設定してください。
          </p>
          <Button
            onClick={() => router.push(`/projects/${projectId}/02-template`)}
          >
            採点領域設定へ移動
          </Button>
        </div>
      </div>
    )
  }

  const currentScoringKey =
    currentAnswerSheet && currentQuestion
      ? `${currentAnswerSheet.id}-${currentQuestion.id}`
      : null
  const currentScoring = currentScoringKey
    ? scoringData[currentScoringKey]
    : null

  return (
    <>
      <Head>
        <title>{project?.examName || "プロジェクト"} - 一括採点</title>
      </Head>
      <div className="flex h-screen flex-col overflow-hidden">
        {/* ヘッダー */}
        <div className="bg-background border-b p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-4">
                <h1 className="text-lg font-semibold">採点</h1>
                <p className="text-muted-foreground text-sm">
                  {gradingMode === "individual"
                    ? `${currentAnswerSheet?.student.lastName} ${currentAnswerSheet?.student.firstName} - `
                    : ""}
                  設問 {currentQuestion?.questionNumber} ({currentQuestion?.points}点)
                </p>
              </div>
              {helpButton}
            </div>

            <div className="flex items-center space-x-2">
              <GradingModeToggle
                mode={gradingMode}
                onModeChange={setGradingMode}
              />
              
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

              <Button 
                onClick={handleInitializeScoringRecords} 
                size="sm" 
                variant="outline"
                title="採点レコードを未採点状態に初期化します"
              >
                初期化
              </Button>
            </div>
          </div>
        </div>

        {/* メインコンテンツエリア */}
        <div className="flex flex-1 min-h-0">
          {gradingMode === "individual" ? (
            /* 個別採点モード: 答案表示エリア */
            <div className="relative flex-1">
              {currentAnswerSheet ? (
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
                <div className="flex h-full items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <FileText className="text-muted-foreground mx-auto mb-2 h-12 w-12" />
                    <p className="text-muted-foreground">
                      答案が選択されていません
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* 一覧採点モード: グリッド表示エリア */
            <div className={`flex-1 p-4 ${
              layoutDirection === "down-right" || layoutDirection === "down-left" 
                ? "overflow-x-auto overflow-y-hidden" 
                : "overflow-y-auto overflow-x-hidden"
            }`}>
              <AnswerGridView
                key={`grid-${filterUpdateKey}`}
                answers={getGridAnswerData()}
                currentQuestionIndex={currentQuestionIndex}
                layoutDirection={layoutDirection}
                gridSize={gridSize}
                onAnswerSelect={handleAnswerSelect}
                onAnswerScore={handleBatchScore}
                selectedAnswers={selectedAnswers}
                currentAnswerId={currentAnswerSheet?.id}
              />
            </div>
          )}

          {/* 共通サイドパネル */}
          {showSidePanel && (
            <div className="bg-background w-64 border-l flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="space-y-2 p-2">
                {/* プロジェクト進捗表示 */}
                <ProjectProgressCard projectId={projectId} />
                
                {/* ナビゲーション - 横並びで高さ圧縮 */}
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs">ナビゲーション</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {/* 設問選択 - 横並びボタン */}
                    <div>
                      <div className="text-muted-foreground text-xs mb-1">設問</div>
                      <div className="grid grid-cols-3 gap-1">
                        {questionRegions.map((question, index) => (
                          <Button
                            key={question.id}
                            size="sm"
                            variant={index === currentQuestionIndex ? "default" : "outline"}
                            onClick={() => setCurrentQuestionIndex(index)}
                            className="h-6 text-xs p-1"
                            title={`${question.questionNumber} (${question.points}点)`}
                          >
                            {question.questionNumber}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* 個別採点モード用の生徒ナビゲーション */}
                    {gradingMode === "individual" && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground text-xs">
                          生徒
                        </span>
                        <div className="flex items-center space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handlePrevStudent}
                            disabled={currentStudentIndex === 0}
                            className="h-5 w-5 p-0"
                          >
                            <ChevronLeft className="h-3 w-3" />
                          </Button>
                          <span className="px-1 font-mono text-xs min-w-[3rem] text-center">
                            {currentStudentIndex + 1}/{answerSheets.length}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleNextStudent}
                            disabled={
                              currentStudentIndex === answerSheets.length - 1
                            }
                            className="h-5 w-5 p-0"
                          >
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* レイアウト方向切り替え（一覧採点モード用） */}
                {gradingMode === "grid" && (
                  <Card>
                    <CardHeader className="pb-1">
                      <CardTitle className="text-xs">表示順序</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-1">
                        <Button
                          size="sm"
                          variant={layoutDirection === "right-down" ? "default" : "outline"}
                          onClick={() => setLayoutDirection("right-down")}
                          className="h-6 text-xs p-1"
                          title="右下順（左上から右に進んで次の行）"
                        >
                          →↓
                        </Button>
                        <Button
                          size="sm"
                          variant={layoutDirection === "left-down" ? "default" : "outline"}
                          onClick={() => setLayoutDirection("left-down")}
                          className="h-6 text-xs p-1"
                          title="左下順（右上から左に進んで次の行）"
                        >
                          ←↓
                        </Button>
                        <Button
                          size="sm"
                          variant={layoutDirection === "down-right" ? "default" : "outline"}
                          onClick={() => setLayoutDirection("down-right")}
                          className="h-6 text-xs p-1"
                          title="下右順（左上から下に進んで次の列）"
                        >
                          ↓→
                        </Button>
                        <Button
                          size="sm"
                          variant={layoutDirection === "down-left" ? "default" : "outline"}
                          onClick={() => setLayoutDirection("down-left")}
                          className="h-6 text-xs p-1"
                          title="下左順（右上から下に進んで次の列）"
                        >
                          ↓←
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 採点操作・フィルタ・ショートカット */}
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs">
                      {gradingMode === "grid" && selectedAnswers.size > 0 
                        ? `${selectedAnswers.size}件を採点` 
                        : "採点操作"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {/* 部分点入力表示 */}
                    {partialScoreInput && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-xs">
                        <div className="font-medium text-yellow-800">部分点入力中</div>
                        <div className="text-yellow-700">
                          {partialScoreInput} / {currentQuestion?.points || 10} 点
                        </div>
                        <div className="text-yellow-600 text-xs mt-1">
                          1.5秒後に自動採点されます...
                        </div>
                      </div>
                    )}
                    
                    {/* 採点ボタン（一覧採点モード用） */}
                    {gradingMode === "grid" && selectedAnswers.size > 0 && (
                      <div className="space-y-1">
                        <Button
                          className="w-full h-6 text-xs justify-start"
                          variant="outline"
                          onClick={() => handleBatchScore(Array.from(selectedAnswers), "ungraded")}
                        >
                          Q: ⚪ 未採点
                        </Button>
                        <Button
                          className="w-full h-6 text-xs justify-start"
                          variant="default"
                          onClick={() => handleBatchScore(Array.from(selectedAnswers), "correct")}
                        >
                          E: ⭕ 正答
                        </Button>
                        <Button
                          className="w-full h-6 text-xs justify-start"
                          variant="secondary"
                          onClick={() => handleBatchScore(Array.from(selectedAnswers), "partial")}
                        >
                          F: 🔸 部分点
                        </Button>
                        <Button
                          className="w-full h-6 text-xs justify-start"
                          variant="destructive"
                          onClick={() => handleBatchScore(Array.from(selectedAnswers), "incorrect")}
                        >
                          O: ❌ 誤答
                        </Button>
                        <Button
                          className="w-full h-6 text-xs justify-start"
                          variant="secondary"
                          onClick={() => handleBatchScore(Array.from(selectedAnswers), "pending")}
                        >
                          J: ⏸️ 保留
                        </Button>
                        <Button
                          className="w-full h-6 text-xs justify-start"
                          variant="destructive"
                          onClick={() => handleBatchScore(Array.from(selectedAnswers), "no_answer")}
                        >
                          P: ➖ 無答
                        </Button>
                      </div>
                    )}
                    
                    {/* フィルタ設定 */}
                    {gradingMode === "grid" && (
                      <div className="border-t pt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium">表示フィルタ</span>
                          {!isFilterSynced() && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleRefreshFilter}
                              className="h-4 text-xs px-1"
                            >
                              R: 更新
                            </Button>
                          )}
                        </div>
                        <div className="space-y-1">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={displayFilter.ungraded}
                              onChange={() => handleToggleFilter('1')}
                              className="rounded"
                            />
                            <span className="text-xs">Alt+Q: 未採点</span>
                          </label>
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={displayFilter.correct}
                              onChange={() => handleToggleFilter('2')}
                              className="rounded"
                            />
                            <span className="text-xs">Alt+E: 正答</span>
                          </label>
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={displayFilter.incorrect}
                              onChange={() => handleToggleFilter('3')}
                              className="rounded"
                            />
                            <span className="text-xs">Alt+O: 誤答</span>
                          </label>
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={displayFilter.partial}
                              onChange={() => handleToggleFilter('4')}
                              className="rounded"
                            />
                            <span className="text-xs">Alt+F: 部分点</span>
                          </label>
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={displayFilter.pending}
                              onChange={() => handleToggleFilter('5')}
                              className="rounded"
                            />
                            <span className="text-xs">Alt+J: 保留</span>
                          </label>
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={displayFilter.no_answer}
                              onChange={() => handleToggleFilter('6')}
                              className="rounded"
                            />
                            <span className="text-xs">Alt+P: 無答</span>
                          </label>
                        </div>
                      </div>
                    )}
                    
                    {/* ショートカット一覧 */}
                    <div className="border-t pt-2">
                      <div className="text-xs font-medium mb-1">ショートカット</div>
                      <div className="space-y-1 text-xs">
                        <div className="grid grid-cols-2 gap-1">
                          <div className="flex items-center gap-1">
                            <kbd className="bg-muted px-1 py-0.5 rounded text-xs">W</kbd>
                            <span className="text-muted-foreground">上</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <kbd className="bg-muted px-1 py-0.5 rounded text-xs">S</kbd>
                            <span className="text-muted-foreground">下</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <kbd className="bg-muted px-1 py-0.5 rounded text-xs">A</kbd>
                            <span className="text-muted-foreground">左</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <kbd className="bg-muted px-1 py-0.5 rounded text-xs">D</kbd>
                            <span className="text-muted-foreground">右</span>
                          </div>
                        </div>
                        <div className="border-t pt-1 mt-1">
                          <div className="text-xs font-medium mb-1">採点・入力</div>
                          <div className="grid grid-cols-1 gap-1">
                            <div className="flex items-center gap-1">
                              <kbd className="bg-muted px-1 py-0.5 rounded text-xs">Q/E/F/J/O/P</kbd>
                              <span className="text-muted-foreground">採点</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <kbd className="bg-muted px-1 py-0.5 rounded text-xs">0-9</kbd>
                              <span className="text-muted-foreground">部分点</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <kbd className="bg-muted px-1 py-0.5 rounded text-xs">⌫</kbd>
                              <span className="text-muted-foreground">部分点リセット</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <kbd className="bg-muted px-1 py-0.5 rounded text-xs">Alt+採点キー</kbd>
                              <span className="text-muted-foreground">フィルタ切替</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 現在の採点状況 */}
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs">現在の採点</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {currentScoring ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-xs">
                            得点
                          </span>
                          <span className="font-medium text-xs">
                            {currentScoring.score}/{currentScoring.maxScore}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-xs">
                            状態
                          </span>
                          <span
                            className={`rounded px-1 py-0.5 text-xs ${
                              currentScoring.status === "correct" || currentScoring.status === "final"
                                ? "bg-green-100 text-green-800"
                                : currentScoring.status === "incorrect"
                                  ? "bg-red-100 text-red-800"
                                  : currentScoring.status === "partial"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : currentScoring.status === "pending"
                                      ? "bg-blue-100 text-blue-800"
                                      : currentScoring.status === "proposed"
                                        ? "bg-orange-100 text-orange-800"
                                        : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {currentScoring.status === "correct"
                              ? "正答"
                              : currentScoring.status === "incorrect"
                                ? "誤答"
                                : currentScoring.status === "partial"
                                  ? "部分点"
                                  : currentScoring.status === "pending"
                                    ? "保留"
                                    : currentScoring.status === "proposed"
                                      ? "提案済み"
                                      : currentScoring.status === "final"
                                        ? "確定"
                                        : "未採点"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-xs">未採点</p>
                    )}
                  </CardContent>
                </Card>

                {/* 採点ボタン（個別採点モードのみ） */}
                {gradingMode === "individual" && (
                  <Card>
                    <CardHeader className="pb-1">
                      <CardTitle className="text-xs">採点操作</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <div className="grid grid-cols-2 gap-1">
                        <Button
                          className="justify-start h-6 text-xs p-1"
                          variant={
                            currentScoring?.status === "ungraded"
                              ? "secondary"
                              : "outline"
                          }
                          onClick={() => handleSetScore("ungraded")}
                        >
                          ⚪ 未採点
                        </Button>
                        <Button
                          className="justify-start h-6 text-xs p-1"
                          variant={
                            currentScoring?.status === "correct"
                              ? "default"
                              : "outline"
                          }
                          onClick={() => handleSetScore("correct")}
                        >
                          ⭕ 正答
                        </Button>
                        <Button
                          className="justify-start h-6 text-xs p-1"
                          variant={
                            currentScoring?.status === "partial"
                              ? "secondary"
                              : "outline"
                          }
                          onClick={() => handleSetScore("partial")}
                        >
                          🔸 部分点
                        </Button>
                        <Button
                          className="justify-start h-6 text-xs p-1"
                          variant={
                            currentScoring?.status === "pending"
                              ? "secondary"
                              : "outline"
                          }
                          onClick={() => handleSetScore("pending")}
                        >
                          ⏸️ 保留
                        </Button>
                        <Button
                          className="justify-start h-6 text-xs p-1"
                          variant={
                            currentScoring?.status === "incorrect"
                              ? "destructive"
                              : "outline"
                          }
                          onClick={() => handleSetScore("incorrect")}
                        >
                          ❌ 誤答
                        </Button>
                        <Button
                          className="justify-start h-6 text-xs p-1"
                          variant={
                            currentScoring?.status === "no_answer"
                              ? "destructive"
                              : "outline"
                          }
                          onClick={() => handleSetScore("no_answer")}
                        >
                          ➖ 無答
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 複数教員比較・次へボタン */}
                <Card>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs">操作</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <Button
                      className="w-full text-xs h-6"
                      variant="outline"
                      onClick={() => setShowScoreComparison(true)}
                      disabled={!currentAnswerSheet || !currentQuestion}
                    >
                      👥 採点結果比較
                    </Button>
                    <Button
                      className="w-full text-xs h-6"
                      variant="default"
                      onClick={() =>
                        router.push(`/projects/${projectId}/07-export`)
                      }
                    >
                      次へ: 結果出力
                    </Button>
                  </CardContent>
                </Card>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 採点結果比較モーダル */}
        {currentAnswerSheet && currentQuestion && (
          <ScoreComparisonModal
            isOpen={showScoreComparison}
            onClose={() => setShowScoreComparison(false)}
            answerSheetId={currentAnswerSheet.id}
            layoutRegionId={currentQuestion.id}
            questionNumber={currentQuestion.questionNumber}
            maxScore={currentQuestion.points}
            studentName={`${currentAnswerSheet.student.lastName} ${currentAnswerSheet.student.firstName}`}
            onScoreFinalized={() => {
              // 採点データを再読み込み
              loadExistingScoringData(projectId).then(setScoringData)
              setShowScoreComparison(false)
            }}
          />
        )}
      </div>
    </>
  )
}
