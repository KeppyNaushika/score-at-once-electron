import type { ScoringStatus } from "@/components/projects/07-score-at-once/components/answer-grid/constants/score-status-config"

export type GridLayoutDirection =
  | "right-down"
  | "left-down"
  | "down-right"
  | "down-left"

export interface QuestionRegion {
  id: string
  label: string
  orderIndex?: number
  points: number
  x: number // 0.0 - 1.0 (画像全体に対する割合)
  y: number // 0.0 - 1.0
  width: number // 0.0 - 1.0
  height: number // 0.0 - 1.0
}

export interface AnswerItem {
  id: string
  studentId: string
  studentName: string
  imageUrl: string
  currentScore?: number
  maxScore: number
  status: ScoringStatus | "master"
  isSelected?: boolean
  questionRegion: QuestionRegion // not null（データフローで保証される）
  isMaster?: boolean
}

export interface AnswerGridViewProps {
  answers: AnswerItem[]
  currentQuestionIndex: number
  layoutDirection: GridLayoutDirection
  gridSize: { columns: number; rows: number }
  onAnswerSelect: (id: string, isSelected: boolean) => void
  onAnswerScore: (id: string | string[], status: ScoringStatus) => void
  selectedAnswers: Set<string>
  className?: string
  onEffectiveColumnsChange?: (columns: number) => void // 実際の列数変更を親に通知
  itemsPerRow?: number[] // 外部からの1行あたり表示件数
  autoScroll?: boolean // 自動スクロール設定
  showStudentNames?: boolean // 生徒名表示設定
}