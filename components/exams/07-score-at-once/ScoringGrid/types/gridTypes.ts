import type {
  MasterGridItem,
  ScoringData,
} from "@/components/exams/07-score-at-once/types"

export type GridAnswerItem = (ScoringData | MasterGridItem) & {
  isSelected?: boolean
}
