import type { UseScoringDataProps } from "@/components/projects/07-score-at-once/hooks/scoring-data/types/scoring-data-types"
import { useScoringDataContainer } from "@/components/projects/07-score-at-once/hooks/scoring-data/hooks/useScoringDataContainer"

export function useScoringData(props: UseScoringDataProps) {
  return useScoringDataContainer(props)
}
