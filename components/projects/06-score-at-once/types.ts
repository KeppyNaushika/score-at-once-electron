// 採点状態の型定義（hooks/use-scoring-keyboard.tsから移動）
export type ScoringStatus =
  | "ungraded"
  | "correct"
  | "incorrect"
  | "partial"
  | "pending"
  | "no_answer"
  | "proposed"
  | "final"

// 採点データの型定義
export interface ScoringData {
  id?: string
  questionId: string
  score: number
  maxScore: number
  status: ScoringStatus
  comment: string
  scoredByUserId: string
  version: number
  updatedAt: Date
}

// 答案の型定義
export interface AnswerSheet {
  id: string
  studentId: string
  projectId: string
  imagePath: string
  pageNumber: number
  status: "uploaded" | "processing" | "ready" | "graded"
  student: {
    id: string
    studentId: string
    lastName: string
    firstName: string
    projectStudents?: { customOrder: number }[] // ProjectStudentデータ
  }
}

// 設問領域の型定義
export interface QuestionRegion {
  id: string
  label: string
  questionNumber: string
  points: number
  x: number
  y: number
  width: number
  height: number
  masterImageId: string // masterImageIdを追加
}

// キーボードショートカットの設定（Python版互換）
export const DEFAULT_SHORTCUTS = {
  ungraded: "q", // 未採点
  correct: "e", // 正答
  partial: "f", // 部分点
  pending: "j", // 保留
  incorrect: "o", // 誤答
  no_answer: "p", // 無答
  nextQuestion: "ArrowRight",
  prevQuestion: "ArrowLeft",
  nextStudent: "ArrowDown",
  prevStudent: "ArrowUp",
  save: "ctrl+s",
}