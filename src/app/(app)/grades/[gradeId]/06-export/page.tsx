"use client"

import { useParams } from "next/navigation"

import { ExportContainer } from "@/components/grades/06-export/ExportContainer"

export default function GradeExportPage() {
  const params = useParams()
  const gradeId = typeof params.gradeId === "string" ? params.gradeId : ""

  return <ExportContainer gradeId={gradeId} />
}
