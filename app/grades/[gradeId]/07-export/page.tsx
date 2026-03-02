"use client"

import { useParams } from "next/navigation"

import { ExportContainer } from "@/components/grades/07-export/ExportContainer"

export default function GradeExportPage() {
  const params = useParams()
  const gradeId = params.gradeId as string

  return <ExportContainer gradeId={gradeId} />
}
