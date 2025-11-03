import type {
  MasterAnswerData,
  ScoringData,
} from "@/components/projects/07-score-at-once/types"

export type GridAnswerItem = (ScoringData | MasterAnswerData) & {
  isSelected?: boolean
}
