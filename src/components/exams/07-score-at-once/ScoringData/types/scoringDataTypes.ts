import type { QuestionScore } from "@prisma/client"

import type {
  CropRegionWithExamPage,
  StudentAnswerImageWithExamStudents,
} from "@/components/exams/07-score-at-once/types"
import type { ScoringStatus } from "@/types/scoringStatus.types"

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
} from "@/components/exams/07-score-at-once/types"

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
  CropRegionWithExamPage,
  QuestionScore,
  ScoringStatus,
  StudentAnswerImageWithExamStudents,
}
