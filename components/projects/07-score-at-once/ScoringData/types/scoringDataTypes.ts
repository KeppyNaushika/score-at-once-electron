import type {
  CropRegionWithProjectPage,
  PageImageWithProjectStudents,
  QuestionScore,
  ScoringStatus,
} from "@/components/projects/07-score-at-once/types"

export interface QuestionProgress {
  [questionId: string]: {
    totalAnswers: number
    gradedAnswers: number
    percentage: number
  }
}

// ClientQuestionScore と ScoringDataRecord は shared.types から使用
export type {
  ClientQuestionScore,
  ScoringDataRecord,
} from "@/components/projects/07-score-at-once/types"

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
  userId: string
}

export type {
  CropRegionWithProjectPage,
  PageImageWithProjectStudents,
  QuestionScore,
  ScoringStatus,
}
