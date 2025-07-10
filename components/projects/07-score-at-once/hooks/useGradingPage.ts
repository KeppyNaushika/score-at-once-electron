"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { GradingMode } from "@/GradingModeToggle"
import { AnswerSheet, QuestionRegion, ScoringData } from "@/types"
import type { ProjectWithDetails } from "@/types/electron"

export function useGradingPage() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string

  // 基本状態
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<ProjectWithDetails | null>(null)
  const [answerSheets, setAnswerSheets] = useState<AnswerSheet[]>([])
  const [questionRegions, setQuestionRegions] = useState<QuestionRegion[]>([])

  // UI状態
  const [gradingMode, setGradingMode] = useState<GradingMode>("grid")
  const [selectedAnswers, setSelectedAnswers] = useState<Set<string>>(new Set())
  const [gridSize, setGridSize] = useState({ columns: 4, rows: 3 })
  const [layoutDirection, setLayoutDirection] = useState<
    "bottom-right" | "bottom-left" | "right-bottom" | "left-bottom"
  >("bottom-right")

  // フィルタ状態
  const [displayFilter, setDisplayFilter] = useState<{
    status: string[]
    showAll: boolean
  }>({
    status: [
      "ungraded",
      "correct",
      "incorrect",
      "partial",
      "pending",
      "no_answer",
    ],
    showAll: true,
  })

  const [appliedFilter, setAppliedFilter] = useState<{
    status: string[]
    showAll: boolean
  }>({
    status: [
      "ungraded",
      "correct",
      "incorrect",
      "partial",
      "pending",
      "no_answer",
    ],
    showAll: true,
  })

  // 採点状態
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [scoringData, setScoringData] = useState<{
    [key: string]: ScoringData
  }>({})
  const [showSidePanel, setShowSidePanel] = useState(true)
  const [autoAdvance, setAutoAdvance] = useState(true)

  // 初期データ読み込み
  const loadProject = useCallback(async () => {
    try {
      setLoading(true)
      const project = await window.electronAPI.fetchProjectById(projectId)
      if (project) {
        setProject(project)
      }
    } catch (error) {
      console.error("Error loading project:", error)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  const loadAnswerSheets = useCallback(async () => {
    try {
      const response =
        await window.electronAPI.getAnswerSheetsByProjectId(projectId)
      if (response && response.success && response.answerSheets) {
        // 型変換: Prismaの型からAnswerSheet型へ
        const answerSheets = response.answerSheets.map(
          (sheet: {
            id: string
            studentId?: string | null
            projectId: string
            originalImagePath?: string | null
            processedImagePath?: string | null
            pageNumber: number
            isScored: boolean
            student?: {
              id: string
              studentId: string
              lastName: string
              firstName: string
              customOrder?: number | null
            } | null
          }) => ({
            id: sheet.id,
            studentId: sheet.studentId || "",
            projectId: sheet.projectId,
            imagePath:
              sheet.originalImagePath || sheet.processedImagePath || "",
            pageNumber: sheet.pageNumber,
            status: sheet.isScored ? ("graded" as const) : ("ready" as const),
            student: sheet.student
              ? {
                  id: sheet.student.id,
                  studentId: sheet.student.studentId,
                  lastName: sheet.student.lastName,
                  firstName: sheet.student.firstName,
                  customOrder: sheet.student.customOrder,
                }
              : {
                  id: "",
                  studentId: "",
                  lastName: "",
                  firstName: "",
                  customOrder: null,
                },
          }),
        )
        setAnswerSheets(answerSheets)
      }
    } catch (error) {
      console.error("Error loading answer sheets:", error)
    }
  }, [projectId])

  const loadQuestionRegions = useCallback(async () => {
    try {
      const regions =
        await window.electronAPI.getLayoutRegionsByProjectId(projectId)
      if (regions && Array.isArray(regions)) {
        // 型変換: LayoutRegion から QuestionRegion へ
        const questionRegions = regions.map((region) => ({
          id: region.id,
          label: region.label,
          questionNumber: region.questionNumber || "",
          points: region.points || 0,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          masterImageId: region.masterImageId || "", // masterImageIdを追加
        }))
        setQuestionRegions(questionRegions)
      }
    } catch (error) {
      console.error("Error loading question regions:", error)
    }
  }, [projectId])

  // 初期化
  useEffect(() => {
    loadProject()
    loadAnswerSheets()
    loadQuestionRegions()
  }, [loadProject, loadAnswerSheets, loadQuestionRegions])

  return {
    // データ
    project,
    answerSheets,
    questionRegions,

    // UI状態
    loading,
    gradingMode,
    setGradingMode,
    selectedAnswers,
    setSelectedAnswers,
    gridSize,
    setGridSize,
    layoutDirection,
    setLayoutDirection,

    // フィルタ
    displayFilter,
    setDisplayFilter,
    appliedFilter,
    setAppliedFilter,

    // 採点状態
    currentStudentIndex,
    setCurrentStudentIndex,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    scoringData,
    setScoringData,
    showSidePanel,
    setShowSidePanel,
    autoAdvance,
    setAutoAdvance,

    // アクション
    loadProject,
    loadAnswerSheets,
    loadQuestionRegions,
  }
}
