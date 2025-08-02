// 採点状態の型定義（hooks/use-scoring-keyboard.tsから移動）
export type ScoringStatus =
  | "unscored"
  | "correct"
  | "incorrect"
  | "partial"
  | "pending"
  | "no_answer"
  | "proposed"
  | "final"

// 採点データの型定義はPrismaのQuestionScoreを使用
export type { QuestionScore } from "@prisma/client"

// 答案の型定義（旧AnswerSheetからStudentAnswerにリネーム）
export interface StudentAnswer {
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
  points: number
  x: number
  y: number
  width: number
  height: number
  projectPageId: string // projectPageIdに変更
}

// Note: DEFAULT_SHORTCUTS は hooks/useScoringKeyboard.ts で定義されています
