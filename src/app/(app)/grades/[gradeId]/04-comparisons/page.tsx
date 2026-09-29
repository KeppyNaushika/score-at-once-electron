"use client"

import { useParams } from "next/navigation"

import { ComparisonsContainer } from "@/components/grades/04-comparisons/ComparisonsContainer"

export default function ComparisonsPage() {
  const params = useParams()
  const gradeId = typeof params.gradeId === "string" ? params.gradeId : ""

  return <ComparisonsContainer gradeId={gradeId} />
}
