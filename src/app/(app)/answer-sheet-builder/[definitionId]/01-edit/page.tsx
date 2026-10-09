"use client"

import { AnswerSheetBuilderMainView } from "@/components/answer-sheet-builder/AnswerSheetBuilderMainView"
import { useRouteParams } from "@/hooks/useRouteParams"

export default function AnswerSheetBuilderEditPage() {
  const params = useRouteParams()
  return <AnswerSheetBuilderMainView definitionId={params.definitionId ?? ""} />
}
