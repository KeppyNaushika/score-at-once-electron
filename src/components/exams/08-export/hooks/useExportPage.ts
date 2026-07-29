"use client"

import type { Exam } from "@prisma/client"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import { defaultScoringMarkConfig } from "@/components/exams/08-export/components/scoring-mark-settings/constants/scoringMarkConstants"
import type { ScoringMarkConfig } from "@/components/exams/08-export/components/scoring-mark-settings/types"
import { useStudentSelection } from "@/components/exams/08-export/hooks/useStudentSelection"
import { ExportOptions, Student } from "@/components/exams/08-export/types"
import {
  DEFAULT_INDIVIDUAL_REPORT_OPTIONS,
  type IndividualReportOptions,
} from "@/electron-src/lib/export/individual-report/types"

/** 結果出力ページの状態（生徒選択・出力設定・採点マーク設定・プログレス）を統合管理するフック */
export function useExportPage() {
  const params = useParams()
  const examId = params.examId as string
  const initializedRef = useRef(false)

  // 基本状態
  const [exam, setExam] = useState<Exam | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

  // フィルタ・検索状態
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedClassrooms, setSelectedClassrooms] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([
    "participating",
  ])

  // 選択状態（Set の変異は useStudentSelection のインテントメソッドに閉じ込める）
  const {
    selectedExamStudentIds,
    replaceSelection,
    toggleStudent,
    addStudents,
    removeStudents,
  } = useStudentSelection()

  // 出力設定
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeScoredAnswers: true,
    includeIndividualReports: false,
    includeGradingData: true,
    format: "pdf",
    markPosition: "bottom-right",
    markSize: 50,
    showMarks: true,
    pdfOrientation: "portrait",
    parallelCount: 4,
  })

  const [scoringMarkConfig, setScoringMarkConfigState] =
    useState<ScoringMarkConfig>(defaultScoringMarkConfig)

  const [individualReportOptions, setIndividualReportOptionsState] =
    useState<IndividualReportOptions>(DEFAULT_INDIVIDUAL_REPORT_OPTIONS)

  // 試験設定の読み込み
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    const loadExamSettings = async () => {
      if (examId && window.electronAPI?.settings) {
        try {
          const result =
            await window.electronAPI.settings.getExamExportSettings(examId)
          if (result.success && result.settings?.scoringMarkConfig) {
            const saved = result.settings
              .scoringMarkConfig as Partial<ScoringMarkConfig>
            // 後方互換性: subtotalScore/totalScore がない場合、summaryScore からフォールバック
            const mergedConfig: ScoringMarkConfig = {
              ...defaultScoringMarkConfig,
              ...saved,
            }
            if (!saved.subtotalScore && saved.summaryScore) {
              mergedConfig.subtotalScore = { ...saved.summaryScore }
            }
            if (!saved.totalScore && saved.summaryScore) {
              mergedConfig.totalScore = { ...saved.summaryScore }
            }
            setScoringMarkConfigState(mergedConfig)
          }

          // 個人成績表オプション（JSON）を基にしつつ、小計グループ選択は
          // source of truth である ExamSubtotalGroup フラグから hydrate する（P5: 亡霊ID排除）
          let baseOptions = DEFAULT_INDIVIDUAL_REPORT_OPTIONS
          if (result.success && result.settings?.individualReportOptions) {
            baseOptions = {
              ...DEFAULT_INDIVIDUAL_REPORT_OPTIONS,
              ...result.settings.individualReportOptions,
            }
          }
          const selection =
            await window.electronAPI.getSubtotalGroupSelection(examId)
          if (selection.success) {
            baseOptions = {
              ...baseOptions,
              tableSubtotalGroupSelection: {
                ...baseOptions.tableSubtotalGroupSelection,
                selectedGroupIds: selection.tableGroupIds,
              },
              boxPlotSubtotalGroupSelection: {
                ...baseOptions.boxPlotSubtotalGroupSelection,
                selectedGroupIds: selection.boxPlotGroupIds,
              },
            }
          }
          setIndividualReportOptionsState(baseOptions)
        } catch (error) {
          console.error("試験設定の読み込みに失敗しました:", error)
        }
      }
    }

    loadExamSettings()
  }, [examId])

  // 採点マーク設定の保存
  const setScoringMarkConfig = useCallback(
    async (
      config:
        ScoringMarkConfig | ((prev: ScoringMarkConfig) => ScoringMarkConfig)
    ) => {
      const newConfig =
        typeof config === "function" ? config(scoringMarkConfig) : config
      setScoringMarkConfigState(newConfig)

      if (examId && window.electronAPI?.settings) {
        try {
          const result =
            await window.electronAPI.settings.getExamExportSettings(examId)
          const currentSettings =
            result.success && result.settings ? result.settings : {}
          await window.electronAPI.settings.saveExamExportSettings(examId, {
            ...currentSettings,
            scoringMarkConfig: newConfig,
          })
        } catch (error) {
          console.error("採点マーク設定の保存に失敗しました:", error)
        }
      }
    },
    [examId, scoringMarkConfig]
  )

  // 個人成績表オプションの保存
  const setIndividualReportOptions = useCallback(
    async (
      options:
        | IndividualReportOptions
        | ((prev: IndividualReportOptions) => IndividualReportOptions)
    ) => {
      const newOptions =
        typeof options === "function"
          ? options(individualReportOptions)
          : options
      setIndividualReportOptionsState(newOptions)

      if (examId && window.electronAPI?.settings) {
        try {
          // 小計グループ選択は relational フラグへ書き込み（source of truth）
          await window.electronAPI.setSubtotalGroupSelection(
            examId,
            newOptions.tableSubtotalGroupSelection.selectedGroupIds,
            newOptions.boxPlotSubtotalGroupSelection.selectedGroupIds
          )

          const result =
            await window.electronAPI.settings.getExamExportSettings(examId)
          const currentSettings =
            result.success && result.settings ? result.settings : {}
          // JSON には selectedGroupIds（エンティティ参照）を残さない。
          // enabled などの非参照設定のみ保持し、ID はフラグから hydrate する。
          await window.electronAPI.settings.saveExamExportSettings(examId, {
            ...currentSettings,
            individualReportOptions: {
              ...newOptions,
              tableSubtotalGroupSelection: {
                ...newOptions.tableSubtotalGroupSelection,
                selectedGroupIds: [],
              },
              boxPlotSubtotalGroupSelection: {
                ...newOptions.boxPlotSubtotalGroupSelection,
                selectedGroupIds: [],
              },
            },
          })
        } catch (error) {
          console.error("個人成績表オプションの保存に失敗しました:", error)
        }
      }
    },
    [examId, individualReportOptions]
  )

  // マスター画像の縦横比からPDF用紙の向きを自動設定
  const orientationInitializedRef = useRef(false)
  useEffect(() => {
    if (orientationInitializedRef.current || !examId) return

    const detectOrientation = async () => {
      try {
        const masterImages =
          await window.electronAPI.getMasterImagesByExamId(examId)
        if (!masterImages || masterImages.length === 0) return

        const firstImage = masterImages[0]
        const imageUrl = await window.electronAPI.resolveFileProtocolPath(
          firstImage.imagePath
        )

        const img = new Image()
        img.src = imageUrl
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error("画像の読み込みに失敗"))
        })

        orientationInitializedRef.current = true
        if (img.naturalWidth > img.naturalHeight) {
          setExportOptions((prev) => ({ ...prev, pdfOrientation: "landscape" }))
        }
      } catch (error) {
        console.error("用紙方向の自動検出に失敗しました:", error)
      }
    }

    detectOrientation()
  }, [examId])

  // プログレス状態
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportStatus, setExportStatus] = useState<
    "processing" | "completed" | "error"
  >("processing")
  const [currentStep, setCurrentStep] = useState("")
  const [isExporting, setIsExporting] = useState(false)

  // データ読み込み
  const loadStudentData = useCallback(async () => {
    try {
      setLoading(true)
      const [examResponse, studentsResponse] = await Promise.all([
        window.electronAPI.getExam(examId),
        window.electronAPI.getStudentsForExam(examId),
      ])

      if (examResponse) {
        setExam(examResponse)
      }

      if (studentsResponse && studentsResponse.success) {
        // 受験生徒順の SSOT は ExamStudent.customOrder（05 で定義）。08 は下流の
        // 読み手なので customOrder のみで並べ、出席番号・氏名などの独自フォールバックは
        // 加えない。getStudentsForExam は customOrder 昇順（同着は studentNumber）で返すため、
        // 同着・未設定は安定ソートでその順序を保つ。未設定（null）は末尾へ。
        const sortedStudents = (studentsResponse.students || []).sort(
          (examStudentA, examStudentB) =>
            (examStudentA.customOrder ?? Number.MAX_SAFE_INTEGER) -
            (examStudentB.customOrder ?? Number.MAX_SAFE_INTEGER)
        )

        setStudents(sortedStudents)
        // デフォルトで参加中の受験者を選択（選択集合は ExamStudent.id で持つ）
        const participatingExamStudentIds = sortedStudents
          .filter((examStudent) => examStudent.status === "participating")
          .map((examStudent) => examStudent.id)
        replaceSelection(participatingExamStudentIds)
      }
    } catch (error) {
      console.error("Failed to load data:", error)
    } finally {
      setLoading(false)
    }
  }, [examId, replaceSelection])

  // 初期化
  useEffect(() => {
    loadStudentData()
  }, [loadStudentData])

  // プログレスリスナーの設定
  useEffect(() => {
    const removeListener = window.electronAPI.onExportProgress?.((progress) => {
      setExportProgress(progress.percentage)
      setCurrentStep(progress.step)
    })

    return removeListener
  }, [])

  // フィルタリング（既にソート済みの students を使用）
  const filteredStudents = students.filter((examStudent) => {
    const student = examStudent.student
    const matchesSearch =
      searchTerm === "" ||
      student.lastName.includes(searchTerm) ||
      student.firstName.includes(searchTerm) ||
      student.studentNumber.includes(searchTerm)

    const matchesClassroom =
      selectedClassrooms.length === 0 ||
      student.memberships.some((membership) =>
        selectedClassrooms.includes(membership.classroom.id)
      )

    const matchesStatus =
      selectedStatuses.length === 0 ||
      selectedStatuses.includes(examStudent.status)

    return matchesSearch && matchesClassroom && matchesStatus
  })

  // 学級一覧取得（生徒が所属している学級のみ、重複なし）
  const availableClassrooms = Array.from(
    new Map(
      students
        .flatMap((examStudent) =>
          examStudent.student.memberships.map(
            (membership) => membership.classroom
          )
        )
        .map((classroom) => [classroom.id, classroom])
    ).values()
  )

  return {
    // データ
    exam,
    students: filteredStudents,
    // 表示フィルタ前の全生徒（返却差分の件数・詳細を表示フィルタと独立させるため）
    allStudents: students,
    availableClassrooms,
    loading,

    // フィルタ・検索
    searchTerm,
    setSearchTerm,
    selectedClassrooms,
    setSelectedClassrooms,
    selectedStatuses,
    setSelectedStatuses,

    // 選択
    selectedStudents: selectedExamStudentIds,
    replaceSelection,
    toggleStudent,
    addStudents,
    removeStudents,

    // 出力設定
    exportOptions,
    setExportOptions,
    scoringMarkConfig,
    setScoringMarkConfig,
    individualReportOptions,
    setIndividualReportOptions,

    // プログレス
    showProgressModal,
    setShowProgressModal,
    exportProgress,
    setExportProgress,
    exportStatus,
    setExportStatus,
    currentStep,
    setCurrentStep,
    isExporting,
    setIsExporting,
  }
}
