"use client"

import { useParams } from "next/navigation"

import { AnswerSheetDefinitionDetail } from "@/components/answer-sheet-builder/AnswerSheetDefinitionDetail"

export default function AnswerSheetBuilderDetailPage() {
  const params = useParams<{ definitionId: string }>()
  return <AnswerSheetDefinitionDetail definitionId={params.definitionId} />
}
