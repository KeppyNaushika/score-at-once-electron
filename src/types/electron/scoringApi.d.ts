import type { QuestionScore } from "@prisma/client"

import type {
  QuestionScoreWithUser,
  SerializedQuestionScore,
} from "../prismaExtensions"
import type { ScoringStatus } from "../scoringStatus.types"

// OWNERによる確定スコア（IPC経由でscoreはnumberに変換済み）
export interface ScoreDecisionForComparison {
  id: string
  cropRegionId: string
  studentId: string
  verdict: string
  score: number | null
  comment: string | null
  decidedByUserId: string
  decidedAt: Date | string
  sourceQuestionScoreId: string | null
  decidedBy: { id: string; name: string; username: string }
}

// QuestionScore comparison result type
export interface QuestionScoreComparisonResult {
  success: boolean
  /** OWNERによる確定。未確定の場合はnull */
  decision?: ScoreDecisionForComparison | null
  /** 採点者ごとの提案（unscoredを除く） */
  proposedScores?: QuestionScoreWithUser[]
  hasConflict?: boolean
  error?: string
}

// QuestionScore operation result type (create/update)
export interface QuestionScoreOperationResult {
  success: boolean
  score?: SerializedQuestionScore
  error?: string
  conflictData?: SerializedQuestionScore
}

/**
 * 採点（QuestionScore）関連API
 */
export interface ScoringAPI {
  // QuestionScore関連のAPI
  getQuestionScore: (id: string) => Promise<QuestionScoreOperationResult>
  getQuestionScoresForExam: (
    examId: string,
    userId?: string
  ) => Promise<{
    success: boolean
    scores?: SerializedQuestionScore[]
    error?: string
  }>
  getQuestionScoresForAnswerSheet: (answerSheetId: string) => Promise<{
    success: boolean
    scores?: SerializedQuestionScore[]
    error?: string
  }>
  createQuestionScore: (data: {
    cropRegionId: string
    studentId: string // v0.4.0+: required
    partialScore?: number
    status: ScoringStatus
    userId: string // v0.4.0+: required
  }) => Promise<QuestionScoreOperationResult>

  updateQuestionScore: (
    id: string,
    data: {
      partialScore?: number
      status?: ScoringStatus
      comment?: string
      version?: number
    },
    expectedVersion?: number
  ) => Promise<QuestionScoreOperationResult>
  deleteQuestionScore: (id: string) => Promise<QuestionScore | void>
  getQuestionScoreComparison: (
    studentId: string,
    cropRegionId: string
  ) => Promise<QuestionScoreComparisonResult>
  finalizeQuestionScore: (
    studentId: string,
    cropRegionId: string,
    userId: string,
    scoreData: {
      partialScore?: number
      status: string
      comments?: string
      sourceQuestionScoreId?: string
    }
  ) => Promise<{
    success: boolean
    decision?: ScoreDecisionForComparison
    error?: string
  }>

  getAnswerSheetProgress: (answerSheetId: string) => Promise<{
    totalQuestions: number
    completedQuestions: number
    percentage: number
  }>
  getExamProgress: (examId: string) => Promise<{
    totalStudents: number
    totalQuestions: number
    totalItems: number
    scoredItems: number
    finalizedItems: number
    scoredPercentage: number
    finalizedPercentage: number
  }>
  initializeScoringRecords: (examId: string) => Promise<{
    success: boolean
    initialized?: number
    message?: string
    error?: string
  }>
  batchUpdateQuestionScores: (
    entries: Array<{
      studentId: string
      cropRegionId: string
      status: string
      partialScore: number | null
      userId: string
    }>
  ) => Promise<{
    success: boolean
    updatedCount: number
    error?: string
  }>
}
