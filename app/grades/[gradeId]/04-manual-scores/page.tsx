"use client"

import { useParams } from "next/navigation"

import { ManualScoresContainer } from "@/components/grades/04-manual-scores/ManualScoresContainer"

export default function ManualScoresPage() {
  const params = useParams()
  const gradeId = params.gradeId as string

  return <ManualScoresContainer gradeId={gradeId} />
}
