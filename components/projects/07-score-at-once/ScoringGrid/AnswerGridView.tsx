"use client"

import AnswerGridContainer from "@/components/projects/07-score-at-once/ScoringGrid/components/AnswerGridContainer"
import type { AnswerGridViewProps } from "@/components/projects/07-score-at-once/ScoringGrid/types/grid-types"

export default function AnswerGridView(props: AnswerGridViewProps) {
  return <AnswerGridContainer {...props} />
}
