import type { UseScoringDataProps } from "@/components/projects/07-score-at-once/ScoringData/types/scoring-data-types"
import { useScoringDataContainer } from "@/components/projects/07-score-at-once/ScoringData/hooks/useScoringDataContainer"

export function useScoringData(props: UseScoringDataProps) {
  return useScoringDataContainer(props)
}
