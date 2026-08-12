"use client"

import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { useStudentSelection } from "@/components/exams/08-export/hooks/useStudentSelection"
import type { ExportOptions, Student } from "@/components/exams/08-export/types"
import {
  DEFAULT_INDIVIDUAL_REPORT_OPTIONS,
  type IndividualReportOptions,
} from "@/electron-src/lib/export/individual-report/types"
import type { ExamExportSettings } from "@/electron-src/lib/prisma/examSettings"
import { queryKeys } from "@/lib/queryKeys"
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

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_STUDENTS: Student[] = []

/** この画面が保存済み設定として持つ形 */
interface SavedExportSettings {
  answerOverlay: AnswerOverlaySettings
  individualReport: IndividualReportOptions
}

export function useExportPage() {
  const params = useParams()
  const examId = params.examId as string
  const queryClient = useQueryClient()

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

  // 保存済みの出力設定。小計グループ選択は SSOT である ExamSubtotalGroup の
  // フラグから解決する（設定JSONに残った亡霊IDを使わない）
  const settingsKey = queryKeys.exam.exportSettings(examId)
  const { data: savedSettings } = useQuery({
    queryKey: settingsKey,
    queryFn: examId
      ? async () => {
          const [settings, selection] = await Promise.all([
            window.electronAPI.settings.getExamExportSettings(examId),
            window.electronAPI.getSubtotalGroupSelection(examId),
          ])
          return {
            answerOverlay: settings.answerOverlay,
            individualReport: {
              ...settings.individualReport,
              tableSubtotalGroupSelection: {
                ...settings.individualReport.tableSubtotalGroupSelection,
                selectedGroupIds: selection.tableGroupIds,
              },
              boxPlotSubtotalGroupSelection: {
                ...settings.individualReport.boxPlotSubtotalGroupSelection,
                selectedGroupIds: selection.boxPlotGroupIds,
              },
            },
          }
        }
      : skipToken,
  })

  /**
   * 取得した設定を編集状態の種にする。
   * 試験を切り替えたら蒔き直す（以前は ref で1回に固定していたため、
   * 別の試験を開いても前の試験の設定が残ったまま保存されていた）。
   */
  const [settingsSeededExamId, setSettingsSeededExamId] = useState<
    string | null
  >(null)
  if (savedSettings && settingsSeededExamId !== examId) {
    setSettingsSeededExamId(examId)
    setAnswerOverlaySettingsState(savedSettings.answerOverlay)
    setIndividualReportOptionsState(savedSettings.individualReport)
  }

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
    if (!pending || !examId) return
    try {
      await window.electronAPI.settings.saveExamExportSettings(examId, pending)
    } catch (error) {
      // 書いた値をキャッシュへ伝えないと、戻ってきたときに保存前の設定が
      // 種になり、そのまま上書き保存される
      await queryClient.invalidateQueries({ queryKey: settingsKey })
      console.error("出力設定の保存に失敗しました:", error)
      toast.error("出力設定の保存に失敗しました", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }, [examId, queryClient, settingsKey])

  const scheduleSettingsSave = useCallback(
    (settings: ExamExportSettings) => {
      // 画面で編集した値がそのまま保存対象。キャッシュにも同じものを載せる
      queryClient.setQueryData<SavedExportSettings>(settingsKey, (cached) =>
        cached
          ? {
              answerOverlay: settings.answerOverlay,
              individualReport: {
                ...settings.individualReport,
                tableSubtotalGroupSelection:
                  cached.individualReport.tableSubtotalGroupSelection,
                boxPlotSubtotalGroupSelection:
                  cached.individualReport.boxPlotSubtotalGroupSelection,
              },
            }
          : cached
      )
      pendingSettingsRef.current = settings
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
      persistTimerRef.current = setTimeout(() => {
        persistTimerRef.current = null
        void flushSettings()
      }, SETTINGS_SAVE_DEBOUNCE_MS)
    },
    [flushSettings, queryClient, settingsKey]
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

      if (examId) {
        try {
          // 小計グループ選択は relational フラグへ書き込み（source of truth）
          await window.electronAPI.setSubtotalGroupSelection(
            examId,
            newOptions.tableSubtotalGroupSelection.selectedGroupIds,
            newOptions.boxPlotSubtotalGroupSelection.selectedGroupIds
          )
          queryClient.setQueryData<SavedExportSettings>(
            settingsKey,
            (cached) =>
              cached ? { ...cached, individualReport: newOptions } : cached
          )
        } catch (error) {
          await queryClient.invalidateQueries({ queryKey: settingsKey })
          console.error("小計グループ選択の保存に失敗しました:", error)
          toast.error("小計点グループの選択を保存できませんでした", {
            description: error instanceof Error ? error.message : undefined,
          })
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
      queryClient,
      settingsKey,
    ]
  )

  // マスター画像の縦横比からPDF用紙の向きを決める
  const { data: detectedOrientation } = useQuery({
    queryKey: queryKeys.exam.masterImageOrientation(examId),
    queryFn: examId
      ? async () => {
          const masterImages =
            await window.electronAPI.getMasterImagesByExamId(examId)
          const firstImage = masterImages[0]
          if (!firstImage?.imagePath) return null

          const imageUrl = await window.electronAPI.resolveFileProtocolPath(
            firstImage.imagePath
          )
          const image = new Image()
          image.src = imageUrl
          await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve()
            image.onerror = () => reject(new Error("画像の読み込みに失敗"))
          })
          return image.naturalWidth > image.naturalHeight
            ? ("landscape" as const)
            : ("portrait" as const)
        }
      : skipToken,
  })

  // 検出した向きを既定値として1度だけ入れる（利用者が変えた後は上書きしない）
  const [orientationSeededExamId, setOrientationSeededExamId] = useState<
    string | null
  >(null)
  if (detectedOrientation && orientationSeededExamId !== examId) {
    setOrientationSeededExamId(examId)
    setExportOptions((previous) => ({
      ...previous,
      pdfOrientation: detectedOrientation,
    }))
  }

  // プログレス状態
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportStatus, setExportStatus] = useState<
    "processing" | "completed" | "error"
  >("processing")
  const [currentStep, setCurrentStep] = useState("")
  const [isExporting, setIsExporting] = useState(false)

  // 試験と受験者は必ず対で使うので1つの取得にまとめる
  const queryKey = queryKeys.exam.exportPage(examId)
  const { data, isPending: loading } = useQuery({
    queryKey,
    queryFn: examId
      ? async () => {
          const [exam, examStudents] = await Promise.all([
            window.electronAPI.getExam(examId),
            window.electronAPI.getStudentsForExam(examId),
          ])
          // 受験生徒順の SSOT は ExamStudent.customOrder（05 で定義）。08 は下流の
          // 読み手なので customOrder のみで並べ、出席番号・氏名などの独自フォールバックは
          // 加えない。getStudentsForExam は customOrder 昇順（同着は studentNumber）で
          // 返すため、同着・未設定は安定ソートでその順序を保つ。未設定（null）は末尾へ。
          const students = [...examStudents].sort(
            (examStudentA, examStudentB) =>
              (examStudentA.customOrder ?? Number.MAX_SAFE_INTEGER) -
              (examStudentB.customOrder ?? Number.MAX_SAFE_INTEGER)
          )
          return { exam, students }
        }
      : skipToken,
  })
  const exam = data?.exam ?? null
  const students = data?.students ?? EMPTY_STUDENTS

  /**
   * 取得できた受験者のうち「参加中」を既定で選ぶ。
   * 取得のたびに選び直すのではなく、初回だけ（利用者が外した選択を戻さない）。
   */
  const [seededExamId, setSeededExamId] = useState<string | null>(null)
  if (data && seededExamId !== examId) {
    setSeededExamId(examId)
    replaceSelection(
      students
        .filter((examStudent) => examStudent.status === "participating")
        .map((examStudent) => examStudent.id)
    )
  }

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
