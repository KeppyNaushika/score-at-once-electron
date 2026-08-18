/**
 * 個人成績表PDF出力機能の型定義
 */

import type { SubtotalGroup } from "@prisma/client"

import type {
  ScoringData,
  StudentExportPlacement,
} from "@/electron-src/lib/shared/types"
import type { ExamStudentStatus } from "@/types/examStudentStatus.types"

import { defineStringUnion } from "./stringUnion"

// ================== 表示モード関連 ==================

/** 表示モード */
const REPORT_DISPLAY_MODES = ["detail", "subtotal_only"] as const
export type ReportDisplayMode = (typeof REPORT_DISPLAY_MODES)[number]
export const { to: toReportDisplayMode } = defineStringUnion(
  REPORT_DISPLAY_MODES,
  "detail"
)

/** 得点率形式 */
export type ScoreRateFormat = "percentage" | "grade5" | "gradeAE"

/** 平均点表示タイプ */
/** 統計の種別 */
export const STATISTIC_KINDS = [
  "average",
  "deviation",
  "rank",
  "boxPlot",
] as const
export type StatisticKind = (typeof STATISTIC_KINDS)[number]
export const { to: toStatisticKind } = defineStringUnion(
  STATISTIC_KINDS,
  "average"
)

/**
 * 統計の母集団。
 * "classroom" は「所属学級それぞれ」— 生徒は複数の学級に属しうる。
 * どの学級かは ExamClassroom.studentReport が決める。
 */
export const STATISTIC_SCOPES = ["classroom", "overall"] as const
export type StatisticScope = (typeof STATISTIC_SCOPES)[number]
export const { to: toStatisticScope } = defineStringUnion(
  STATISTIC_SCOPES,
  "overall"
)

/** 統計を種別×母集団で出すかどうか */
export type StatisticVisibility = Record<
  StatisticKind,
  Record<StatisticScope, boolean>
>

/** 順位表示タイプ */
/** テーブル列数（最大10列） */
const REPORT_PAGE_LAYOUTS = ["auto", "single", "double"] as const
export type ReportPageLayout = (typeof REPORT_PAGE_LAYOUTS)[number]
export const { to: toReportPageLayout } = defineStringUnion(
  REPORT_PAGE_LAYOUTS,
  "auto"
)

const REPORT_PAGE_ORIENTATIONS = ["portrait", "landscape"] as const
export type ReportPageOrientation = (typeof REPORT_PAGE_ORIENTATIONS)[number]
export const { to: toReportPageOrientation } = defineStringUnion(
  REPORT_PAGE_ORIENTATIONS,
  "portrait"
)

export type TableColumns = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

/** DB の整数列を列数へ絞る（範囲外は1列） */
export function toTableColumns(value: number): TableColumns {
  return value >= 1 && value <= 10 ? (value as TableColumns) : 1
}

/** 設問テーブル列数 */
export type QuestionTableColumns = TableColumns

/** 小計点テーブル列数 */
export type SubtotalTableColumns = TableColumns

/** フォントサイズ（px単位） */
export type FontSizeOption = number

// ================== オプション関連 ==================

/** グラフオプション */
export interface GraphOptions {
  showBarChart: boolean
  showRadarChart: boolean
  /** 合計点の箱ひげ図（小計別とは別に先頭へ足す。母集団の話ではない） */
  showTotalScoreBoxPlot: boolean
  // 箱ひげ図の詳細オプション
  showBoxPlotMin: boolean // 最小値のヒゲを表示
  showBoxPlotQ1: boolean // Q1（第1四分位数）を表示
  showBoxPlotMedian: boolean // 中央値を表示
  showBoxPlotQ3: boolean // Q3（第3四分位数）を表示
  showBoxPlotMax: boolean // 最大値のヒゲを表示
  showAverageLine: boolean // 平均線を表示
  showStudentMarker: boolean // 生徒の得点マーカーを表示
  // 箱ひげ図のサイズオプション
  boxPlotFontSize: number // フォントサイズ（px）、箱の高さもこれに比例
  boxPlotItemHeight: number // 項目間の間隔（px）
}

/** 学習アドバイスオプション */
export interface AdviceOptions {
  // 復習問題の条件（nullは条件なし）
  reviewRateMin: number | null // 正答率の下限（この値以上）、nullで条件なし
  reviewRateMax: number | null // 正答率の上限（この値以下）、nullで条件なし
  reviewQuestionCount: number | null // 表示する問題数、nullで全て表示
}

/** 個人成績表オプション */
export interface IndividualReportOptions {
  // 表示モード
  displayMode: ReportDisplayMode

  // 基本表示要素
  showScore: boolean
  showMarks: boolean
  scoreRateFormat: ScoreRateFormat

  /** 統計（平均・偏差値・順位・箱ひげ図）を、所属学級ごと／全体それぞれで出すか */
  statistics: StatisticVisibility

  // 小計点関連
  showSubtotalTable: boolean
  subtotalTableColumns: SubtotalTableColumns
  subtotalTableFontSize: FontSizeOption
  showGraph: boolean
  graphOptions: GraphOptions
  tableSubtotalGroupSelection: SubtotalGroupSelection // 小計点テーブル用グループ選択
  boxPlotSubtotalGroupSelection: SubtotalGroupSelection // 箱ひげ図用グループ選択
  hideUnassignedSubtotals: boolean // 設問と関連付けのない小計点を非表示
  showGroupSubtotals: boolean // グループごとの合計を表示
  /** 統計に含める受験状態（平均・偏差値・順位・箱ひげ図で共通） */
  boxPlotIncludeStatuses: {
    participating: boolean
    expected: boolean
    absent: boolean
  }

  // 設問関連
  showQuestionTable: boolean
  questionTableColumns: QuestionTableColumns
  questionTableFontSize: FontSizeOption
  showCorrectRate: boolean // 正答率を表示
  showScoreRate: boolean // 得点率を表示

  // 学習アドバイス
  showLearningAdvice: boolean
  adviceOptions: AdviceOptions

  // 行政要素
  showComment: boolean
  showSignature: boolean

  // ページ設定
  pageLayout: ReportPageLayout
  pageOrientation: ReportPageOrientation
}

// ================== データ構造 ==================

/** 生徒情報（成績表用） */
export interface StudentInfoForReport {
  id: string
  fullName: string
  studentNumber: string
  grade: string | null
  className: string | null
  attendanceNumber: number | null
}

/** 試験情報 */
export interface ExamInfoForReport {
  examName: string
  examDate: Date | null
  tags: string[]
}

/** 生徒ごとの小計点データ（renderer側計算用） */
export interface StudentSubtotalScore {
  studentId: string
  score: number | null
  status: ExamStudentStatus
}

/** 小計別生スコアデータ（renderer側でのbox plot計算用） */
export interface SubtotalRawScores {
  subtotalId: string
  scores: StudentSubtotalScore[]
}

/** 生徒ごとの合計点データ（統計の母集団） */
export interface RawTotalScoreEntry {
  studentId: string
  totalScore: number | null
  status: ExamStudentStatus
}

/** 小計の識別・表示情報（統計値は持たない） */
export interface ReportSubtotal {
  subtotalId: string
  subtotalLabel: string
  maxScore: number
  /** SubtotalGroup ID */
  subtotalGroupId: string
}

/** SubtotalGroup選択UI用（Prisma型のサブセット。id/name のみ使用） */
export type SubtotalGroupInfo = Pick<SubtotalGroup, "id" | "name">

/** SubtotalGroup選択オプション */
export interface SubtotalGroupSelection {
  enabled: boolean
  selectedGroupIds: string[]
}

/**
 * 生徒表示（studentReport）対象の学級と、その受験日所属生徒。
 *
 * ある生徒の学級統計の母集団は「本人が memberStudentIds に含まれる学級」全体。
 * 1人の生徒が複数の studentReport 学級に属することがある。
 */
export interface ReportClassroom {
  classroomId: string
  className: string
  grade: string | null
  /** 当該学級の受験日所属生徒ID。rawTotalScores を絞り込むキー */
  memberStudentIds: string[]
}

/**
 * 個人成績表の統計母集団。試験に1つで、生徒ごとには変わらない。
 *
 * 平均・偏差値・順位・箱ひげ図といった統計値はここに持たない。renderer 側の
 * computeReportData が受験状態フィルタを適用して算出する（同じ式を main と
 * renderer に二重実装しない）。
 */
export interface ReportPopulation {
  /** 全受験者の合計点 */
  rawTotalScores: RawTotalScoreEntry[]
  /** 小計ごとの全受験者得点 */
  subtotalRawScores: SubtotalRawScores[]
  /** 小計の識別・表示情報 */
  subtotals: ReportSubtotal[]
  /** 生徒表示対象の学級 */
  classrooms: ReportClassroom[]
  /**
   * 設問別正答率。renderer は全受験者の設問別得点を持たないため main で集計する
   * （素点を渡すと受験者数×設問数のペイロードになる）。
   */
  questionCorrectRates: Record<string, number>
  /** 設問別得点率。集計を main で行う理由は questionCorrectRates と同じ */
  questionScoreRates: Record<string, number>
}

/** 学習アドバイス用問題データ */
export interface AdviceQuestion {
  questionId: string
  label: string
  correctRate: number
  yourScore: number
  maxScore: number
}

/** 学習アドバイスデータ */
export interface LearningAdviceData {
  reviewQuestions: AdviceQuestion[]
}

/** 個人成績表1枚分のデータ。母集団は生徒ごとに変わらないので ReportPopulation が持つ */
export interface IndividualReportData {
  studentInfo: StudentInfoForReport
  examInfo: ExamInfoForReport
  scoringData: ScoringData
  learningAdvice: LearningAdviceData
}

// ================== API関連 ==================

/** 個人成績表データ取得オプション */
export interface GetIndividualReportDataOptions {
  examId: string
  selectedExamStudentIds: string[]
  options: IndividualReportOptions
  /** renderer が採番解決して渡す表示学級情報（**Student.id キー**。学級所属は人に紐づく） */
  studentPlacements?: Record<string, StudentExportPlacement>
}

/** 個人成績表データ取得結果 */
export interface GetIndividualReportDataResult {
  reports: IndividualReportData[]
  examInfo: ExamInfoForReport
  /** 統計の母集団（試験に1つ） */
  population: ReportPopulation
}

// ================== デフォルト値 ==================

/** デフォルトのグラフオプション */
const DEFAULT_GRAPH_OPTIONS: GraphOptions = {
  showBarChart: true,
  showRadarChart: true,
  showTotalScoreBoxPlot: false,
  showBoxPlotMin: true,
  showBoxPlotQ1: true,
  showBoxPlotMedian: true,
  showBoxPlotQ3: true,
  showBoxPlotMax: true,
  showAverageLine: true,
  showStudentMarker: true,
  boxPlotFontSize: 11,
  boxPlotItemHeight: 20, // 項目間の間隔（px）
}

/** デフォルトのアドバイスオプション */
const DEFAULT_ADVICE_OPTIONS: AdviceOptions = {
  reviewRateMin: 70, // 正答率70%以上
  reviewRateMax: null, // 上限なし
  reviewQuestionCount: 5, // 上位5問を表示
}

/** デフォルトの個人成績表オプション */
export const DEFAULT_INDIVIDUAL_REPORT_OPTIONS: IndividualReportOptions = {
  displayMode: "detail",
  showScore: true,
  showMarks: true,
  scoreRateFormat: "percentage",
  statistics: {
    average: { classroom: true, overall: true },
    deviation: { classroom: false, overall: true },
    rank: { classroom: true, overall: true },
    boxPlot: { classroom: false, overall: true },
  },
  showSubtotalTable: true,
  subtotalTableColumns: 1,
  subtotalTableFontSize: 10,
  showGraph: true,
  graphOptions: DEFAULT_GRAPH_OPTIONS,
  tableSubtotalGroupSelection: {
    enabled: false,
    selectedGroupIds: [],
  },
  boxPlotSubtotalGroupSelection: {
    enabled: false,
    selectedGroupIds: [],
  },
  hideUnassignedSubtotals: true,
  showGroupSubtotals: true,
  boxPlotIncludeStatuses: {
    participating: true,
    expected: true,
    absent: false,
  },
  showQuestionTable: true,
  questionTableColumns: 1,
  questionTableFontSize: 10,
  showCorrectRate: true,
  showScoreRate: false,
  showLearningAdvice: true,
  adviceOptions: DEFAULT_ADVICE_OPTIONS,
  showComment: false,
  showSignature: false,
  pageLayout: "auto",
  pageOrientation: "portrait",
}
