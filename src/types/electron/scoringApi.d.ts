import type { QuestionScore } from "@prisma/client"

import type {
  QuestionScoreWithRelations,
  QuestionScoreWithUser,
} from "../prismaExtensions"

// QuestionScore comparison result type
export interface QuestionScoreComparisonResult {
  success: boolean
  finalScore?: QuestionScoreWithUser
  proposedScores?: QuestionScoreWithUser[]
  hasConflict?: boolean
  error?: string
}

// QuestionScore operation result type (create/update)
export interface QuestionScoreOperationResult {
  success: boolean
  score?: QuestionScoreWithRelations
  error?: string
  conflictData?: QuestionScore
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
    scores?: QuestionScore[]
    error?: string
  }>
  getQuestionScoresForAnswerSheet: (answerSheetId: string) => Promise<{
    success: boolean
    scores?: QuestionScore[]
    error?: string
  }>
  createQuestionScore: (data: {
    cropRegionId: string
    studentId: string // v0.4.0+: required
    partialScore?: number
    status:
      | "unscored"
      | "correct"
      | "incorrect"
      | "partial"
      | "pending"
      | "no_answer"
      | "proposed"
      | "final"
      | "double_mark"
    userId: string // v0.4.0+: required
  }) => Promise<QuestionScoreOperationResult>

  updateQuestionScore: (
    id: string,
    data: {
      partialScore?: number
      status?:
        | "unscored"
        | "correct"
        | "incorrect"
        | "partial"
        | "pending"
        | "no_answer"
        | "proposed"
        | "final"
        | "double_mark"
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
    }
  ) => Promise<QuestionScoreOperationResult>

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
