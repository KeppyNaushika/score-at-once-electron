"use client"

import { AnswerSheetExportView } from "@/components/answer-sheet-builder/AnswerSheetExportView"
import { useRouteParams } from "@/hooks/useRouteParams"

export default function AnswerSheetBuilderExportPage() {
  const params = useRouteParams()
  return <AnswerSheetExportView definitionId={params.definitionId ?? ""} />
}
