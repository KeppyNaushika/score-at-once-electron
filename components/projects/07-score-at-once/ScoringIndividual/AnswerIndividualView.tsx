"use client"

import AnswerDisplayContainer from "./components/AnswerDisplayContainer"
import type { AnswerIndividualViewProps } from "./types/answer-individual-types"

export default function AnswerIndividualView(props: AnswerIndividualViewProps) {
  return <AnswerDisplayContainer {...props} />
}
