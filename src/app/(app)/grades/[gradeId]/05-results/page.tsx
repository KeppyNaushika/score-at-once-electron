"use client"

import { ResultsContainer } from "@/components/grades/05-results/ResultsContainer"
import { useRouteParams } from "@/hooks/useRouteParams"

export default function ResultsPage() {
  const params = useRouteParams()
  const gradeId = params.gradeId ?? ""

  return <ResultsContainer gradeId={gradeId} />
}
