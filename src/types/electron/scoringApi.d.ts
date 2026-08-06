import type { SCORE_TARGET_DELETED } from "@/electron-src/lib/prisma/questionScore"

import type {
  AnswerWhiteness,
  WhitenessTargetAnswerImage,
  WhitenessTargetRegion,
} from "../answerWhiteness.types"
import type { SerializedQuestionScore } from "../prismaExtensions"
import type {
  CropRegionAssignmentSummary,
  ExamDecisionSummary,
} from "../scoreDecision.types"
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
  examStudentId: string
  verdict: string
  score: number | null
  comment: string | null
  decidedByUserId: string
  decidedAt: Date | string
  sourceQuestionScoreId: string | null
  decidedBy: { id: string; name: string; username: string }
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
  createQuestionScore: (data: {
    cropRegionId: string
    examStudentId: string
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
  finalizeQuestionScore: (
    examStudentId: string,
    cropRegionId: string,
    userId: string,
    scoreData: {
      partialScore?: number
      /** ScoreDecision の verdict、または旧API互換の "final"（点数有無から verdict を導出）。 */
      status: string
      comment?: string
      sourceQuestionScoreId?: string
    }
  ) => Promise<{
    success: boolean
    decision?: ScoreDecisionForComparison
    error?: string
  }>
  /** 裁定サマリ（解決できなかった競合・確定後に新提案が入ったセル） */
  getExamDecisionSummary: (
    examId: string,
    userId: string
  ) => Promise<{
    success: boolean
    summary?: ExamDecisionSummary
    error?: string
  }>
  /** 設問ごとの採点担当（採点画面の設問絞り込み用の軽量版） */
  getCropRegionAssignments: (
    examId: string,
    userId: string
  ) => Promise<{
    success: boolean
    assignments?: CropRegionAssignmentSummary[]
    canManage?: boolean
    /** 試験のメンバー数（協調採点かの安価な判定材料） */
    memberCount?: number
    error?: string
  }>
  assignCropRegion: (
    cropRegionId: string,
    userId: string,
    assignedByUserId: string
  ) => Promise<{ success: boolean; error?: string }>
  unassignCropRegion: (
    cropRegionId: string,
    userId: string,
    requestedByUserId: string
  ) => Promise<{ success: boolean; error?: string }>
  batchUpdateQuestionScores: (
    entries: Array<{
      examStudentId: string
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
  /** 答案画像ごとに、指定した全採点領域の白さ（空欄らしさ）を算出する */
  measureAnswerWhiteness: (args: {
    answerImages: WhitenessTargetAnswerImage[]
    regions: WhitenessTargetRegion[]
  }) => Promise<{
    success: boolean
    answers?: AnswerWhiteness[]
    error?: string
  }>
}
