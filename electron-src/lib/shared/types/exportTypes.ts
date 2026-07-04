// Excel・PDF出力で共通的に使用される型定義

import type { ScoringStatus } from "@/types/scoringStatus.types"

export interface ExportGradingDataOptions {
  examId: string
  selectedStudentIds: string[]
  outputPath?: string
  forceExport?: boolean // 警告を無視して強制実行
}

export interface ScoringData {
  studentId: string
  studentName: string
  studentNumber: string
  grade?: string
  className?: string
  attendanceNumber?: number | null
  status?: "participating" | "expected" | "absent"
  scores: ScoreDetail[]
  totalScore: number | null
  totalMaxScore: number
  subtotalScores: SubtotalScore[]
}

export interface SubtotalScore {
  /** Subtotal ID */
  subtotalId: string
  /** SubtotalGroup ID */
  subtotalGroupId: string
  /** SubtotalGroup名 */
  subtotalGroupName: string
  /** 小計点ラベル（Subtotal.name） */
  subtotalLabel: string
  /** 得点（全設問unscoredの場合はnull） */
  score: number | null
  /** 最大点 */
  maxScore: number
  /** QUESTION_ASSIGNMENTが存在するか（設問と関連付けられているか） */
  hasQuestionAssignments: boolean
}

/** SubtotalGroupとその小計項目の情報（Excel・個人成績表出力で共通） */
export interface SubtotalGroupData {
  groupId: string
  groupName: string
  subtotals: Array<{
    id: string
    name: string
    order: number
  }>
}

export interface ScoreDetail {
  questionId: string
  questionLabel: string
  daimon?: string
  shomon?: string
  shimon?: string
  score: number | null
  maxScore: number
  status: ScoringStatus
}

export interface ExportResult {
  success: boolean
  outputPath?: string
  error?: string
  warnings?: {
    noScoringData: string[]
    ungraded: string[]
    missingPartialScore: string[]
  }
  validationResult?: {
    hasWarnings: boolean
    warnings: {
      noScoringData: string[]
      ungraded: string[]
      missingPartialScore: string[]
    }
  }
}

// 問題分析関連の型定義
export type DiscriminationLevel =
  "good" | "acceptable" | "marginal" | "poor" | "negative" | "insufficient"

export interface ItemAnalysisRow {
  questionId: string
  questionLabel: string
  maxScore: number
  correctRate: number
  scoreRate: number
  discriminationIndex: number | null
}

// Excel固有の型定義
export interface ExcelExportOptions extends ExportGradingDataOptions {
  includeScoreSheet?: boolean
  includeResultSheet?: boolean
}

// PDF固有の型定義
export interface PDFExportOptions extends ExportGradingDataOptions {
  markSettings?: MarkSettings
}

export interface MarkSettings {
  correctMarkPath: string
  incorrectMarkPath: string
  partialMarkPath: string
  noAnswerMarkPath: string
  useTransparentMarks: boolean
  markPosition:
    | "top-left"
    | "top-center"
    | "top-right"
    | "center-left"
    | "center"
    | "center-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right"
}
