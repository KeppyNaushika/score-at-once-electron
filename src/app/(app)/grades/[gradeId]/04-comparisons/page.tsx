"use client"

import { ComparisonsContainer } from "@/components/grades/04-comparisons/ComparisonsContainer"
import { useRouteParams } from "@/hooks/useRouteParams"

export default function ComparisonsPage() {
  const params = useRouteParams()
  const gradeId = params.gradeId ?? ""

  return <ComparisonsContainer gradeId={gradeId} />
}
