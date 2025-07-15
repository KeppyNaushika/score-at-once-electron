// Excel・PDF出力で共通的に使用される型定義

export interface ExportGradingDataOptions {
  projectId: string
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
  attendanceNumber?: number
  scores: ScoreDetail[]
  totalScore: number
  totalMaxScore: number
  subtotalScores: SubtotalScore[]
}

export interface SubtotalScore {
  subtotalRegionId: string
  subtotalLabel: string
  score: number
  maxScore: number
}

export interface ScoreDetail {
  questionId: string
  questionLabel: string
  daimon?: string
  shomon?: string
  shimon?: string
  score: number | null
  maxScore: number
  status: "unscored" | "correct" | "partial" | "hold" | "incorrect" | "no_answer"
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
  markPosition: 'top-left' | 'top-center' | 'top-right' | 'center-left' | 'center' | 'center-right' | 'bottom-left' | 'bottom-center' | 'bottom-right'
}