"use client"

import { BoundariesContainer } from "@/components/grades/03-boundaries/BoundariesContainer"
import { useRouteParams } from "@/hooks/useRouteParams"

export default function BoundariesPage() {
  const params = useRouteParams()
  const gradeId = params.gradeId ?? ""

  return <BoundariesContainer gradeId={gradeId} />
}
