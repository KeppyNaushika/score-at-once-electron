"use client"

import { useParams } from "next/navigation"

import { DataSourcesContainer } from "@/components/grades/03-data-sources/DataSourcesContainer"

export default function DataSourcesPage() {
  const params = useParams()
  const gradeId = params.gradeId as string

  return <DataSourcesContainer gradeId={gradeId} />
}
