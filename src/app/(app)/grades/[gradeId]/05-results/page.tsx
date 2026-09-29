"use client"

import { useParams } from "next/navigation"

import { ResultsContainer } from "@/components/grades/05-results/ResultsContainer"

export default function ResultsPage() {
  const params = useParams()
  const gradeId = typeof params.gradeId === "string" ? params.gradeId : ""

  return <ResultsContainer gradeId={gradeId} />
}
