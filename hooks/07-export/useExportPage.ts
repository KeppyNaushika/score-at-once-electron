"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  Student,
  ExportOptions,
} from "../../app/projects/[projectId]/07-export/types"
import {
  ScoringMarkConfig,
  defaultScoringMarkConfig,
} from "../../components/projects/07-export/ScoringMarkSettings"

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
  })

  const [scoringMarkConfig, setScoringMarkConfig] = useState<ScoringMarkConfig>(
    defaultScoringMarkConfig,
  )

  // プログレス状態
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
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
        setStudents(studentsResponse.students || [])
        // デフォルトで参加中の学生を選択
        const participatingStudents = (studentsResponse.students || [])
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

  // フィルタリング
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

  // 学級一覧取得
  const availableClasses = Array.from(
    new Set(students.flatMap((s) => s.memberships.map((m) => m.class))),
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
    isExporting,
    setIsExporting,

    // アクション
    loadStudentData,
  }
}
