"use client"

import { AnswerSheetDefinitionDetail } from "@/components/answer-sheet-builder/AnswerSheetDefinitionDetail"
import { useRouteParams } from "@/hooks/useRouteParams"

export default function AnswerSheetBuilderDetailPage() {
  const params = useRouteParams()
  return (
    <AnswerSheetDefinitionDetail definitionId={params.definitionId ?? ""} />
  )
}
