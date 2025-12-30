/**
 * 個人成績表PDF出力機能の型定義
 */

import type { ScoringData } from "../../shared/types/export-types"

// ================== 表示モード関連 ==================

/** 表示モード */
export type ReportDisplayMode = "detail" | "subtotal_only"

/** 得点率形式 */
export type ScoreRateFormat = "percentage" | "grade5" | "gradeAE"

/** 平均点表示タイプ */
export type AverageDisplayType = "class" | "overall" | "both" | "none"

/** 問題フィルタリング方式 */
export type QuestionFilterMode = "top_n" | "all_matching"

/** 順位表示タイプ */
export type RankDisplayType = "class" | "overall" | "both"

// ================== オプション関連 ==================

/** グラフオプション */
export interface GraphOptions {
  showBarChart: boolean
  showRadarChart: boolean
  showBoxPlot: boolean
  showAverageLine: boolean
}

/** 学習アドバイスオプション */
export interface AdviceOptions {
  // 差がつく問題
  showDifferentiatingQuestions: boolean
  differentiatingRateMin: number
  differentiatingRateMax: number
  differentiatingFilterMode: QuestionFilterMode
  differentiatingTopN: number

  // 必ず復習問題
  showMustReviewQuestions: boolean
  mustReviewRateMin: number
  mustReviewFilterMode: QuestionFilterMode
  mustReviewTopN: number
}

/** 個人成績表オプション */
export interface IndividualReportOptions {
  // 表示モード
  displayMode: ReportDisplayMode

  // 基本表示要素
  showScore: boolean
  showMarks: boolean
  showAverage: AverageDisplayType
  scoreRateFormat: ScoreRateFormat

  // 統計情報
  showDeviation: boolean
  showRank: boolean
  rankType: RankDisplayType

  // グラフ
  showGraph: boolean
  graphOptions: GraphOptions

  // 学習アドバイス
  showLearningAdvice: boolean
  adviceOptions: AdviceOptions

  // 行政要素
  showComment: boolean
  showSignature: boolean

  // ページ設定
  pageLayout: "auto" | "single" | "double"
  pageOrientation: "portrait" | "landscape"
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
  subject: string | null
}

/** 箱ひげ図用統計データ */
export interface BoxPlotData {
  min: number
  q1: number
  median: number
  q3: number
  max: number
}

/** 小計別統計データ */
export interface SubtotalStatistics {
  subtotalId: string
  subtotalLabel: string
  average: number
  stdDev: number
  boxPlot: BoxPlotData
}

/** 統計データ */
export interface StatisticsData {
  // 全体統計
  overall: {
    average: number
    stdDev: number
    boxPlot: BoxPlotData
    total: number
  }

  // 学級統計
  class: {
    average: number
    stdDev: number
    boxPlot: BoxPlotData
    total: number
  }

  // 個人統計
  personal: {
    deviation: number
    overallRank: number
    classRank: number
  }

  // 設問別正答率
  questionCorrectRates: Record<string, number>

  // 小計別統計
  subtotalStatistics: SubtotalStatistics[]
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
  differentiatingQuestions: AdviceQuestion[]
  mustReviewQuestions: AdviceQuestion[]
}

/** 個人成績表1枚分のデータ */
export interface IndividualReportData {
  studentInfo: StudentInfoForReport
  examInfo: ExamInfoForReport
  scoringData: ScoringData
  statistics: StatisticsData
  learningAdvice: LearningAdviceData
}

// ================== API関連 ==================

/** 個人成績表データ取得オプション */
export interface GetIndividualReportDataOptions {
  projectId: string
  selectedStudentIds: string[]
  options: IndividualReportOptions
}

/** 個人成績表データ取得結果 */
export interface GetIndividualReportDataResult {
  success: boolean
  reports?: IndividualReportData[]
  examInfo?: ExamInfoForReport
  error?: string
  warnings?: {
    noScoringData: string[]
    ungraded: string[]
  }
}

// ================== デフォルト値 ==================

/** デフォルトのグラフオプション */
export const DEFAULT_GRAPH_OPTIONS: GraphOptions = {
  showBarChart: true,
  showRadarChart: true,
  showBoxPlot: true,
  showAverageLine: true,
}

/** デフォルトのアドバイスオプション */
export const DEFAULT_ADVICE_OPTIONS: AdviceOptions = {
  showDifferentiatingQuestions: true,
  differentiatingRateMin: 40,
  differentiatingRateMax: 60,
  differentiatingFilterMode: "top_n",
  differentiatingTopN: 3,

  showMustReviewQuestions: true,
  mustReviewRateMin: 80,
  mustReviewFilterMode: "top_n",
  mustReviewTopN: 3,
}

/** デフォルトの個人成績表オプション */
export const DEFAULT_INDIVIDUAL_REPORT_OPTIONS: IndividualReportOptions = {
  displayMode: "detail",
  showScore: true,
  showMarks: true,
  showAverage: "both",
  scoreRateFormat: "percentage",
  showDeviation: true,
  showRank: true,
  rankType: "both",
  showGraph: true,
  graphOptions: DEFAULT_GRAPH_OPTIONS,
  showLearningAdvice: true,
  adviceOptions: DEFAULT_ADVICE_OPTIONS,
  showComment: false,
  showSignature: false,
  pageLayout: "auto",
  pageOrientation: "portrait",
}
