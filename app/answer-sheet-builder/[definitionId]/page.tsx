"use client"

import { useParams } from "next/navigation"

import { AnswerSheetBuilderMainView } from "@/components/answer-sheet-builder/AnswerSheetBuilderMainView"

export default function AnswerSheetBuilderEditorPage() {
  const params = useParams<{ definitionId: string }>()
  return <AnswerSheetBuilderMainView definitionId={params.definitionId} />
}
