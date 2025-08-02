import type {
  StudentAnswer,
  QuestionRegion,
  QuestionScore,
  ScoringStatus,
} from "@/components/projects/07-score-at-once/ScoringMain/types"

export interface UseScoringDataProps {
  currentUserId: string | null
  setCurrentUserId: (userId: string) => void
  gradingMode: "grid" | "individual"
  currentStudentIndex: number
  setCurrentStudentIndex: (index: number) => void
  currentQuestionIndex: number
  setCurrentQuestionIndex: (index: number) => void
  studentAnswers: StudentAnswer[]
  questionRegions: QuestionRegion[]
}

export interface QuestionProgress {
  [questionId: string]: {
    totalAnswers: number
    gradedAnswers: number
    percentage: number
  }
}

/**
 * クライアントサイド用のQuestionScore型
 * partialScoreをDecimalからnumberに変更（UI状態管理用）
 */
export interface ClientQuestionScore extends Omit<QuestionScore, 'partialScore'> {
  partialScore: number | null
}

export interface ScoringDataRecord {
  [key: string]: ClientQuestionScore
}

export interface ScoreUpdateData {
  partialScore?: number
  status: ScoringStatus
  comment: string
}

export interface ScoreCreateData {
  studentId: string
  cropRegionId: string
  partialScore?: number
  status: ScoringStatus
  comment: string
  scoredByUserId: string
}

export type { StudentAnswer, QuestionRegion, QuestionScore, ScoringStatus }