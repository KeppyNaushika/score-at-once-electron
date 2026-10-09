"use client"

import { ExportContainer } from "@/components/grades/06-export/ExportContainer"
import { useRouteParams } from "@/hooks/useRouteParams"

export default function GradeExportPage() {
  const params = useRouteParams()
  const gradeId = params.gradeId ?? ""

  return <ExportContainer gradeId={gradeId} />
}
