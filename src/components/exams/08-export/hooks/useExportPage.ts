"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useCallback, useMemo, useState } from "react"

import { useStudentSelection } from "@/components/exams/08-export/hooks/useStudentSelection"
import type { ExportOptions, Student } from "@/components/exams/08-export/types"
import type { ExportSettingChange } from "@/components/exams/08-export/utils/exportSettingChanges"
import {
  answerOverlayChanges,
  individualReportChanges,
} from "@/components/exams/08-export/utils/exportSettingChanges"
import { examDetailQuery, examStudentsQuery } from "@/queries/exam"
import {
  examExportSettingsQuery,
  setExamAnswerOverlayStyleMutation,
  setExamAnswerOverlayVisibilityMutation,
  setExamReportGraphSettingsMutation,
  setExamReportSettingsMutation,
  setExamReportStatisticVisibilityMutation,
  setExamReportTableSectionMutation,
} from "@/queries/settings"
import {
  setSubtotalGroupSelectionMutation,
  subtotalGroupSelectionQuery,
} from "@/queries/subtotal"
import {
  DEFAULT_INDIVIDUAL_REPORT_OPTIONS,
  type IndividualReportOptions,
} from "@/types/individualReport.types"
import type { AnswerOverlaySettings } from "@/types/scoringOverlay.types"
import { DEFAULT_ANSWER_OVERLAY_SETTINGS } from "@/types/scoringOverlay.types"

import { useMasterImageOrientation } from "./useMasterImageOrientation"

/** 選ばれている小計点グループが変わったか。並びも選択の一部なのでそのまま比べる */
function hasDifferentGroupSelection(
  next: readonly string[],
  previous: readonly string[]
): boolean {
  return (
    next.length !== previous.length ||
    next.some((groupId, index) => groupId !== previous[index])
  )
}

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_STUDENTS: Student[] = []

/**
 * 結果出力ページの状態（生徒選択・出力設定・採点マーク設定・プログレス）を統合管理するフック。
 *
 * 設定の保存にデバウンスは置かない。以前は 400ms まとめてから書いていたが、
 * 「画面には出ているが DB には無い」窓を作るうえ、そのあいだキャッシュへ書いた
 * 値（＝楽観更新）が取り直しと競り合っていた。1つの操作で1レコード書く。
 */
export function useExportPage() {
  const params = useParams()
  const examId = params.examId as string

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

  // 出力設定（この画面の中だけで使う。DB には書かない）
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

  const queryClient = useQueryClient()

  // 保存済みの出力設定と、小計グループの選択。選択の正本は ExamSubtotalGroup の
  // フラグなので、設定JSONに残った亡霊IDは使わない
  const { data: savedSettings } = useQuery({
    ...examExportSettingsQuery(examId),
    enabled: Boolean(examId),
  })
  const { data: savedSelection } = useQuery({
    ...subtotalGroupSelectionQuery(examId),
    enabled: Boolean(examId),
  })
  const { mutateAsync: setSubtotalGroupSelection } = useMutation(
    setSubtotalGroupSelectionMutation(examId)
  )

  // 出力設定は6テーブルに分かれている。変わった行だけを、その行の口から書く。
  // `mutate` だけを取り出すのは、`useMutation` の戻り値が毎レンダー別物になり、
  // それを依存に入れると下流の props が毎レンダー作り直されるため
  const { mutateAsync: setOverlayStyle } = useMutation(
    setExamAnswerOverlayStyleMutation(examId)
  )
  const { mutateAsync: setOverlayVisibility } = useMutation(
    setExamAnswerOverlayVisibilityMutation(examId)
  )
  const { mutateAsync: setStatisticVisibility } = useMutation(
    setExamReportStatisticVisibilityMutation(examId)
  )
  const { mutateAsync: setReportSettings } = useMutation(
    setExamReportSettingsMutation(examId)
  )
  const { mutateAsync: setReportTableSection } = useMutation(
    setExamReportTableSectionMutation(examId)
  )
  const { mutateAsync: setReportGraphSettings } = useMutation(
    setExamReportGraphSettingsMutation(examId)
  )

  /**
   * 取得した設定を編集状態の種にする。
   *
   * 種は「どの試験の、どのデータから蒔いたか」で覚える。試験を切り替えたら蒔き
   * 直す（以前は ref で1回に固定していたため、別の試験を開いても前の試験の設定が
   * 残ったまま保存されていた）。
   *
   * 書き込みに失敗したときも蒔き直すが、**取り直しが終わってから**にする。
   * 合図だけで蒔き直すと、取り直しがまだ走っている最中の（＝古い）キャッシュから
   * 戻してしまい、以後 DB と食い違ったままになる。待つのは
   * `invalidateQueries` の解決で、「データが変わったか」では見ない
   * （失敗したときは DB が変わらないので、変化を待つと**一度も蒔き直せない**）。
   */
  const [seeded, setSeeded] = useState<{
    examId: string
    settings: typeof savedSettings
    selection: typeof savedSelection
  } | null>(null)
  const [reseedRequested, setReseedRequested] = useState(false)
  const requestReseed = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: examExportSettingsQuery(examId).queryKey,
      }),
      queryClient.invalidateQueries({
        queryKey: subtotalGroupSelectionQuery(examId).queryKey,
      }),
    ])
    setReseedRequested(true)
  }, [queryClient, examId])

  const needsSeed =
    savedSettings !== undefined &&
    savedSelection !== undefined &&
    (seeded?.examId !== examId || reseedRequested)

  if (needsSeed && savedSettings && savedSelection) {
    setSeeded({ examId, settings: savedSettings, selection: savedSelection })
    setReseedRequested(false)
    setAnswerOverlaySettingsState(savedSettings.answerOverlay)
    setIndividualReportOptionsState({
      ...savedSettings.individualReport,
      tableSubtotalGroupSelection: {
        ...savedSettings.individualReport.tableSubtotalGroupSelection,
        selectedGroupIds: savedSelection.tableGroupIds,
      },
      boxPlotSubtotalGroupSelection: {
        ...savedSettings.individualReport.boxPlotSubtotalGroupSelection,
        selectedGroupIds: savedSelection.boxPlotGroupIds,
      },
    })
  }

  /**
   * 変わった行を、その行の口から1件ずつ書く。
   *
   * 失敗は `mutate` の第2引数ではなく **`mutateAsync` の拒否で受ける**。1回の操作が
   * 同じ口を複数回叩くことがあり（「デフォルトに戻す」は最大10行）、`mutate` の
   * コールバックは同じ観測子を使い回すぶん**最後の1件しか届かない**
   * （query-core の `MutationObserver.mutate` が前回の観測を外す）。
   */
  const writeChanges = useCallback(
    (changes: ExportSettingChange[]) => {
      const write = (writing: Promise<unknown>) => {
        // 書けなかった行は次の操作では拾われない。DB から蒔き直させる
        void writing.catch(requestReseed)
      }

      for (const change of changes) {
        switch (change.kind) {
          case "overlayStyle":
            write(setOverlayStyle(change.style))
            break
          case "overlayVisibility":
            write(setOverlayVisibility(change.visibility))
            break
          case "statisticVisibility":
            write(
              setStatisticVisibility({
                statisticKind: change.statisticKind,
                scope: change.scope,
                shown: change.shown,
              })
            )
            break
          case "reportSettings":
            write(setReportSettings(change.individualReport))
            break
          case "reportTableSection":
            write(
              setReportTableSection({
                tableKind: change.tableKind,
                values: change.values,
              })
            )
            break
          case "reportGraphSettings":
            write(setReportGraphSettings(change.values))
            break
        }
      }
    },
    [
      requestReseed,
      setOverlayStyle,
      setOverlayVisibility,
      setReportGraphSettings,
      setReportSettings,
      setReportTableSection,
      setStatisticVisibility,
    ]
  )

  // 採点マーク設定の保存。1回の操作で確定するので即時に書く
  const setAnswerOverlaySettings = useCallback(
    (
      config:
        | AnswerOverlaySettings
        | ((prev: AnswerOverlaySettings) => AnswerOverlaySettings)
    ) => {
      // 更新関数の中から書かない。React が更新関数を2度走らせることがあるので、
      // 1つの操作が2件の書き込みになる（段階11 で同じ形の不具合を踏んでいる）
      const next =
        typeof config === "function" ? config(answerOverlaySettings) : config
      setAnswerOverlaySettingsState(next)
      writeChanges(answerOverlayChanges(answerOverlaySettings, next))
    },
    [answerOverlaySettings, writeChanges]
  )

  // 個人成績表オプションの保存。小計グループの選択だけは別のテーブル
  const setIndividualReportOptions = useCallback(
    (
      options:
        | IndividualReportOptions
        | ((prev: IndividualReportOptions) => IndividualReportOptions)
    ) => {
      const next =
        typeof options === "function"
          ? options(individualReportOptions)
          : options
      setIndividualReportOptionsState(next)

      // 選ばれたグループの id は ExamSubtotalGroup のフラグが正本。変わって
      // いないのに書くと、フォントサイズを1文字打つたびに関係ない行まで触る
      if (
        hasDifferentGroupSelection(
          next.tableSubtotalGroupSelection.selectedGroupIds,
          individualReportOptions.tableSubtotalGroupSelection.selectedGroupIds
        ) ||
        hasDifferentGroupSelection(
          next.boxPlotSubtotalGroupSelection.selectedGroupIds,
          individualReportOptions.boxPlotSubtotalGroupSelection.selectedGroupIds
        )
      ) {
        void setSubtotalGroupSelection({
          tableGroupIds: next.tableSubtotalGroupSelection.selectedGroupIds,
          boxPlotGroupIds: next.boxPlotSubtotalGroupSelection.selectedGroupIds,
        }).catch(requestReseed)
      }

      writeChanges(individualReportChanges(individualReportOptions, next))
    },
    [
      individualReportOptions,
      requestReseed,
      setSubtotalGroupSelection,
      writeChanges,
    ]
  )

  // マスター画像の縦横比からPDF用紙の向きを決める
  const detectedOrientation = useMasterImageOrientation(examId)

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

  const { data: exam = null, isPending: examPending } = useQuery({
    ...examDetailQuery(examId),
    enabled: Boolean(examId),
  })
  const { data: examStudents, isPending: studentsPending } = useQuery({
    ...examStudentsQuery(examId),
    enabled: Boolean(examId),
  })

  /**
   * 受験生徒順の SSOT は ExamStudent.customOrder（05 で定義）。08 は下流の読み手なので
   * customOrder のみで並べ、出席番号・氏名などの独自フォールバックは加えない。
   * `getStudentsForExam` は customOrder 昇順（同着は studentNumber）で返すため、
   * 同着・未設定は安定ソートでその順序を保つ。未設定（null）は末尾へ。
   */
  const students = useMemo(
    () =>
      examStudents
        ? [...examStudents].sort(
            (examStudentA, examStudentB) =>
              (examStudentA.customOrder ?? Number.MAX_SAFE_INTEGER) -
              (examStudentB.customOrder ?? Number.MAX_SAFE_INTEGER)
          )
        : EMPTY_STUDENTS,
    [examStudents]
  )

  /**
   * 取得できた受験者のうち「参加中」を既定で選ぶ。
   * 取得のたびに選び直すのではなく、初回だけ（利用者が外した選択を戻さない）。
   */
  const [seededExamId, setSeededExamId] = useState<string | null>(null)
  if (examStudents && seededExamId !== examId) {
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
    loading: examPending || studentsPending,

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
