"use client"

import {
  ExportOptions,
  Student,
} from "@/app/projects/[projectId]/08-export/types"
import {
  ScoringMarkConfig,
  defaultScoringMarkConfig,
} from "@/components/projects/08-export/ScoringMarkSettings"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

// localStorageから設定を読み込む関数
function loadScoringMarkConfig(): ScoringMarkConfig {
  if (typeof window === "undefined") return defaultScoringMarkConfig

  try {
    const stored = localStorage.getItem("scoring-mark-config")
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        ...defaultScoringMarkConfig,
        ...parsed,
        showMarkForStatus: {
          ...defaultScoringMarkConfig.showMarkForStatus,
          ...(parsed.showMarkForStatus || {}),
        },
        showScoreForStatus: {
          ...defaultScoringMarkConfig.showScoreForStatus,
          ...(parsed.showScoreForStatus || {}),
        },
      }
    }
  } catch (error) {
    console.error(
      "Failed to load scoring mark config from localStorage:",
      error,
    )
  }

  return defaultScoringMarkConfig
}

export function useExportPage() {
  const params = useParams()
  const projectId = params.projectId as string

  // 基本状態
  const [project, setProject] = useState<any>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

  // フィルタ・検索状態
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedClasses, setSelectedClasses] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([
    "participating",
  ])

  // 選択状態
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(
    new Set(),
  )

  // 出力設定
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeScoredAnswers: true,
    includeIndividualReports: false,
    includeGradingData: true,
    format: "pdf",
    markPosition: "bottom-right",
    markSize: 50,
    showMarks: true,
    pdfOrientation: "portrait", // デフォルトはA4縦
  })

  const [scoringMarkConfig, setScoringMarkConfig] = useState<ScoringMarkConfig>(
    loadScoringMarkConfig(),
  )

  // プログレス状態
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportStatus, setExportStatus] = useState<
    "processing" | "completed" | "error"
  >("processing")
  const [currentStep, setCurrentStep] = useState("")
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [totalSteps, setTotalSteps] = useState(7)
  const [isExporting, setIsExporting] = useState(false)

  // データ読み込み
  const loadStudentData = useCallback(async () => {
    try {
      setLoading(true)
      const [projectResponse, studentsResponse] = await Promise.all([
        window.electronAPI.fetchProjectById(projectId),
        window.electronAPI.getStudentsForProject(projectId),
      ])

      if (projectResponse) {
        setProject(projectResponse)
      }

      if (studentsResponse && studentsResponse.success) {
        // 受験生徒順（customOrder）でソート
        const sortedStudents = (studentsResponse.students || []).sort(
          (a: any, b: any) => {
            // customOrderが設定されている場合はそれを優先
            if (
              a.customOrder !== null &&
              a.customOrder !== undefined &&
              b.customOrder !== null &&
              b.customOrder !== undefined
            ) {
              return a.customOrder - b.customOrder
            }
            if (a.customOrder !== null && a.customOrder !== undefined) return -1
            if (b.customOrder !== null && b.customOrder !== undefined) return 1

            // customOrderが未設定の場合は出席番号順をフォールバック
            const aAttendanceNumber = a.memberships?.[0]?.attendanceNumber
            const bAttendanceNumber = b.memberships?.[0]?.attendanceNumber

            if (aAttendanceNumber && bAttendanceNumber) {
              return aAttendanceNumber - bAttendanceNumber
            }
            if (aAttendanceNumber) return -1
            if (bAttendanceNumber) return 1

            // 出席番号もない場合は名前順
            const aName = `${a.lastName}${a.firstName}`
            const bName = `${b.lastName}${b.firstName}`
            return aName.localeCompare(bName, "ja")
          },
        )

        setStudents(sortedStudents)
        // デフォルトで参加中の学生を選択
        const participatingStudents = sortedStudents
          .filter((s: any) => s.status === "participating")
          .map((s: any) => s.id)
        setSelectedStudents(new Set(participatingStudents))
      }
    } catch (error) {
      console.error("Failed to load data:", error)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  // 初期化
  useEffect(() => {
    loadStudentData()
  }, [loadStudentData])

  // プログレスリスナーの設定
  useEffect(() => {
    const removeListener = window.electronAPI.onExportProgress?.((progress) => {
      setExportProgress(progress.percentage)
      setCurrentStep(progress.step)
      setCurrentStepIndex(progress.currentStepIndex || 0)
      setTotalSteps(progress.totalSteps || 7)
    })

    return removeListener
  }, [])

  // フィルタリング（既にソート済みの students を使用）
  const filteredStudents = students.filter((student) => {
    const matchesSearch =
      searchTerm === "" ||
      student.lastName.includes(searchTerm) ||
      student.firstName.includes(searchTerm) ||
      student.studentId.includes(searchTerm)

    const matchesClass =
      selectedClasses.length === 0 ||
      student.memberships.some((m) => selectedClasses.includes(m.class.id))

    const matchesStatus =
      selectedStatuses.length === 0 || selectedStatuses.includes(student.status)

    return matchesSearch && matchesClass && matchesStatus
  })

  // 学級一覧取得（生徒が所属している学級のみ、重複なし）
  const availableClasses = Array.from(
    new Map(
      students
        .flatMap((s) => s.memberships.map((m) => m.class))
        .map((cls) => [cls.id, cls])
    ).values()
  )

  return {
    // データ
    project,
    students: filteredStudents,
    availableClasses,
    loading,

    // フィルタ・検索
    searchTerm,
    setSearchTerm,
    selectedClasses,
    setSelectedClasses,
    selectedStatuses,
    setSelectedStatuses,

    // 選択
    selectedStudents,
    setSelectedStudents,

    // 出力設定
    exportOptions,
    setExportOptions,
    scoringMarkConfig,
    setScoringMarkConfig,

    // プログレス
    showProgressModal,
    setShowProgressModal,
    exportProgress,
    setExportProgress,
    exportStatus,
    setExportStatus,
    currentStep,
    setCurrentStep,
    currentStepIndex,
    setCurrentStepIndex,
    totalSteps,
    setTotalSteps,
    isExporting,
    setIsExporting,

    // アクション
    loadStudentData,
  }
}
