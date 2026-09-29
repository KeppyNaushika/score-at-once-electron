"use client"

import { useParams } from "next/navigation"

import { DataSourcesContainer } from "@/components/grades/02-data-sources/DataSourcesContainer"

export default function DataSourcesPage() {
  const params = useParams()
  const gradeId = typeof params.gradeId === "string" ? params.gradeId : ""

  return <DataSourcesContainer gradeId={gradeId} />
}
