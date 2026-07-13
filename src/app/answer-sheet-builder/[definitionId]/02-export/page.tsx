"use client"

import { useParams } from "next/navigation"

import { AnswerSheetExportView } from "@/components/answer-sheet-builder/AnswerSheetExportView"

export default function AnswerSheetBuilderExportPage() {
  const params = useParams<{ definitionId: string }>()
  return <AnswerSheetExportView definitionId={params.definitionId} />
}
