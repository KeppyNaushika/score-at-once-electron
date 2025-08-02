"use client"

import AnswerDisplayContainer from "./answer-display/components/AnswerDisplayContainer"
import type { AnswerDisplayViewerProps } from "./answer-display/types/answer-display-types"

export default function AnswerDisplayViewer(props: AnswerDisplayViewerProps) {
  return <AnswerDisplayContainer {...props} />
}