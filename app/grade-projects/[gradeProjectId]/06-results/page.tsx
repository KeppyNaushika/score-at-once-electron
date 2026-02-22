"use client"

import { useParams } from "next/navigation"

import { ResultsContainer } from "@/components/grade-projects/06-results/ResultsContainer"

export default function ResultsPage() {
  const params = useParams()
  const gradeProjectId = params.gradeProjectId as string

  return <ResultsContainer gradeProjectId={gradeProjectId} />
}
