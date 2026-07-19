import type { QuestionScore } from "@prisma/client"

import type { SCORE_TARGET_DELETED } from "@/electron-src/lib/prisma/questionScore"

import type {
  QuestionScoreWithUser,
  SerializedQuestionScore,
} from "../prismaExtensions"
import type { ScoringStatus } from "../scoringStatus.types"

/**
 * QuestionScore 作成引数（IPC）。SSOT の SerializedQuestionScore から
 * 生成列を減算し、partialScore（number）と status（union）は任意で注入する。
 */
export type CreateQuestionScoreArgs = Omit<
  SerializedQuestionScore,
  "id" | "createdAt" | "updatedAt" | "partialScore" | "status"
> & { partialScore?: number | null; status?: ScoringStatus }

/**
 * QuestionScore 更新引数（IPC）。SerializedQuestionScore の可変列の部分集合。
 */
export type UpdateQuestionScoreArgs = Partial<
  Pick<SerializedQuestionScore, "partialScore" | "status">
>

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
  /**
   * 失敗理由の機械可読コード。"target-deleted" は対象の採点が既に無い＝答案ごと
   * 削除された場合（協調採点で他教員が削除）。単なる保存失敗と区別して扱うこと。
   */
  reason?: typeof SCORE_TARGET_DELETED
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
      /** ScoreDecision の verdict、または旧API互換の "final"（点数有無から verdict を導出）。 */
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
      status: ScoringStatus
      partialScore: number | null
      userId: string
    }>
  ) => Promise<{
    success: boolean
    updatedCount: number
    error?: string
  }>
}
