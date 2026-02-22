"use client"

import { useParams } from "next/navigation"

import { ManualScoresContainer } from "@/components/grade-projects/04-manual-scores/ManualScoresContainer"

export default function ManualScoresPage() {
  const params = useParams()
  const gradeProjectId = params.gradeProjectId as string

  return <ManualScoresContainer gradeProjectId={gradeProjectId} />
}
