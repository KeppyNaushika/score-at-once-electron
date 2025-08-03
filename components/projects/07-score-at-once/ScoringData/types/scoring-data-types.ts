import type {
  CropRegionWithProjectPage,
  PageImageWithProjectStudents,
  QuestionScore,
  ScoringStatus,
} from "@/components/projects/07-score-at-once/types"

export interface UseScoringDataProps {
  currentUserId: string | null
  setCurrentUserId: (userId: string) => void
  gradingMode: "grid" | "individual"
  currentStudentIndex: number
  setCurrentStudentIndex: (index: number) => void
  currentCropRegionId: string | null
  setCurrentCropRegionId: (id: string | null) => void
  pageImages: PageImageWithProjectStudents[]
  cropRegions: CropRegionWithProjectPage[]
}

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
  scoredByUserId: string
}

export type {
  CropRegionWithProjectPage,
  PageImageWithProjectStudents,
  QuestionScore,
  ScoringStatus,
}
