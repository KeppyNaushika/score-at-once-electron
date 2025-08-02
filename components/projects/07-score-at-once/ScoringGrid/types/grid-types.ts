import type { ScoringData } from "@/components/projects/07-score-at-once/types/scoring-data.types"
import type { ScoringStatus } from "@/components/projects/07-score-at-once/types/shared.types"

export type GridLayoutDirection =
  | "right-down"
  | "left-down"
  | "down-right"
  | "down-left"

// CropRegionWithProjectPage, PageImageWithProjectStudents を使用
export type GridAnswerItem = ScoringData & { isSelected?: boolean }

export interface AnswerGridViewProps {
  // 統一されたデータ引数
  allScoringData: ScoringData[]
  filteredScoringDataIds: Set<string>
  selectedScoringDataIds: Set<string>
  currentCropRegionId: string | null

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
