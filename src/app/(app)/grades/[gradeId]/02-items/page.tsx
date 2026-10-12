"use client"

import { DataSourcesContainer } from "@/components/grades/02-items/DataSourcesContainer"
import { useRouteParams } from "@/hooks/useRouteParams"

export default function DataSourcesPage() {
  const params = useRouteParams()
  const gradeId = params.gradeId ?? ""

  return <DataSourcesContainer gradeId={gradeId} />
}
