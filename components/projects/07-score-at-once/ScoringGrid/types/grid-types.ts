import type { ScoringData } from "@/components/projects/07-score-at-once/types/scoring-data.types"
import type { ScoringStatus } from "@/components/projects/07-score-at-once/types/shared.types"

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

// ScoringDataとAnswerItemの互換性を確保（将来的にAnswerItemはScoringDataに統一予定）
export type GridAnswerItem = ScoringData & { isSelected?: boolean }

export interface AnswerGridViewProps {
  // 統一されたデータ引数
  allScoringData: ScoringData[]
  filteredScoringDataIds: Set<string>
  selectedScoringDataIds: Set<string>

  // 設問情報
  currentQuestionIndex: number

  // 操作関数
  onScoringDataSelect: (id: string, isSelected: boolean) => void
  onScoringDataScore: (id: string | string[], status: ScoringStatus) => void

  // 表示設定
  layoutDirection: GridLayoutDirection
  itemsPerRow?: number[] // 外部からの1行/列あたり表示件数
  autoScroll?: boolean // 自動スクロール設定
  showStudentNames?: boolean // 生徒名表示設定
  className?: string
}
