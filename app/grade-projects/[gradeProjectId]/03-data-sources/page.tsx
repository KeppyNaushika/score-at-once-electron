"use client"

import { useParams } from "next/navigation"

import { DataSourcesContainer } from "@/components/grade-projects/03-data-sources/DataSourcesContainer"

export default function DataSourcesPage() {
  const params = useParams()
  const gradeProjectId = params.gradeProjectId as string

  return <DataSourcesContainer gradeProjectId={gradeProjectId} />
}
