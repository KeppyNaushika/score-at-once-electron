import type {
  MasterGridItem,
  ScoringData,
} from "@/components/projects/07-score-at-once/types"

export type GridAnswerItem = (ScoringData | MasterGridItem) & {
  isSelected?: boolean
}
