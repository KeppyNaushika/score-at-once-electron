"use client"

import AnswerGridContainer from "@/components/projects/07-score-at-once/components/answer-grid/components/AnswerGridContainer"
import type { AnswerGridViewProps } from "@/components/projects/07-score-at-once/components/answer-grid/types/grid-types"

export default function AnswerGridView(props: AnswerGridViewProps) {
  return <AnswerGridContainer {...props} />
}