"use client"

import { useParams } from "next/navigation"

import { ExportContainer } from "@/components/grade-projects/07-export/ExportContainer"

export default function GradeExportPage() {
  const params = useParams()
  const gradeProjectId = params.gradeProjectId as string

  return <ExportContainer gradeProjectId={gradeProjectId} />
}
