"use client"

import type { Exam } from "@prisma/client"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import { useStudentSelection } from "@/components/exams/08-export/hooks/useStudentSelection"
import { ExportOptions, Student } from "@/components/exams/08-export/types"
import {
  DEFAULT_INDIVIDUAL_REPORT_OPTIONS,
  type IndividualReportOptions,
} from "@/electron-src/lib/export/individual-report/types"
import type { ExamExportSettings } from "@/electron-src/lib/prisma/examSettings"
import type { AnswerOverlaySettings } from "@/types/scoringOverlay.types"
import { DEFAULT_ANSWER_OVERLAY_SETTINGS } from "@/types/scoringOverlay.types"

/** 結果出力ページの状態（生徒選択・出力設定・採点マーク設定・プログレス）を統合管理するフック */
/** 打鍵ごとに共有DBへ書きに行かないための待ち時間（ms） */
const SETTINGS_SAVE_DEBOUNCE_MS = 400

/**
 * 選択されたグループID（エンティティ参照）は設定側に持たない。
 * enabled などの非参照設定のみ保持し、IDは ExamSubtotalGroup のフラグから hydrate する。
 */
function withoutSelectedGroupIds(
  options: IndividualReportOptions
): IndividualReportOptions {
  return {
    ...options,
    tableSubtotalGroupSelection: {
      ...options.tableSubtotalGroupSelection,
      selectedGroupIds: [],
    },
    boxPlotSubtotalGroupSelection: {
      ...options.boxPlotSubtotalGroupSelection,
      selectedGroupIds: [],
    },
  }
}

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

  const [answerOverlaySettings, setAnswerOverlaySettingsState] =
    useState<AnswerOverlaySettings>(DEFAULT_ANSWER_OVERLAY_SETTINGS)

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
          if (result.success && result.settings) {
            setAnswerOverlaySettingsState(result.settings.answerOverlay)
          }

          // 小計グループ選択は source of truth である
          // ExamSubtotalGroup フラグから hydrate する（P5: 亡霊ID排除）
          let baseOptions =
            result.success && result.settings
              ? result.settings.individualReport
              : DEFAULT_INDIVIDUAL_REPORT_OPTIONS
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

  /**
   * 出力設定の保存。
   *
   * 数値入力は打鍵ごとに呼ばれるうえ、保存は 20 行以上の upsert を1トランザクションで
   * 走らせる。共有フォルダ上の SQLite ではロックを取り合うので、書き込みだけ遅らせる。
   * 画面の状態は即時に更新するので体感は変わらない。
   */
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSettingsRef = useRef<ExamExportSettings | null>(null)

  const flushSettings = useCallback(async () => {
    const pending = pendingSettingsRef.current
    pendingSettingsRef.current = null
    if (!pending || !examId || !window.electronAPI?.settings) return
    try {
      await window.electronAPI.settings.saveExamExportSettings(examId, pending)
    } catch (error) {
      console.error("出力設定の保存に失敗しました:", error)
    }
  }, [examId])

  const scheduleSettingsSave = useCallback(
    (settings: ExamExportSettings) => {
      pendingSettingsRef.current = settings
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
      persistTimerRef.current = setTimeout(() => {
        persistTimerRef.current = null
        void flushSettings()
      }, SETTINGS_SAVE_DEBOUNCE_MS)
    },
    [flushSettings]
  )

  // 画面を離れるときは書き残しを吐き出す
  useEffect(() => {
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
      void flushSettings()
    }
  }, [flushSettings])

  // 採点マーク設定の保存
  const setAnswerOverlaySettings = useCallback(
    (
      config:
        | AnswerOverlaySettings
        | ((prev: AnswerOverlaySettings) => AnswerOverlaySettings)
    ) => {
      const newConfig =
        typeof config === "function" ? config(answerOverlaySettings) : config
      setAnswerOverlaySettingsState(newConfig)
      scheduleSettingsSave({
        answerOverlay: newConfig,
        individualReport: withoutSelectedGroupIds(individualReportOptions),
      })
    },
    [answerOverlaySettings, individualReportOptions, scheduleSettingsSave]
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
        } catch (error) {
          console.error("小計グループ選択の保存に失敗しました:", error)
        }
      }

      scheduleSettingsSave({
        answerOverlay: answerOverlaySettings,
        individualReport: withoutSelectedGroupIds(newOptions),
      })
    },
    [
      answerOverlaySettings,
      examId,
      individualReportOptions,
      scheduleSettingsSave,
    ]
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
    answerOverlaySettings,
    setAnswerOverlaySettings,
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
