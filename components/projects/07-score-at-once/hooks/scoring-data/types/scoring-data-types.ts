import type {
  AnswerSheet,
  QuestionRegion,
  ScoringData,
  ScoringStatus,
} from "@/components/projects/07-score-at-once/types"

export interface UseScoringDataProps {
  currentUserId: string | null
  setCurrentUserId: (userId: string) => void
  gradingMode: "grid" | "individual"
  currentStudentIndex: number
  setCurrentStudentIndex: (index: number) => void
  currentQuestionIndex: number
  setCurrentQuestionIndex: (index: number) => void
  answerSheets: AnswerSheet[]
  questionRegions: QuestionRegion[]
}

export interface QuestionProgress {
  [questionId: string]: {
    totalAnswers: number
    gradedAnswers: number
    percentage: number
  }
}

export interface ScoringDataRecord {
  [key: string]: ScoringData
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

export type { AnswerSheet, QuestionRegion, ScoringData, ScoringStatus }