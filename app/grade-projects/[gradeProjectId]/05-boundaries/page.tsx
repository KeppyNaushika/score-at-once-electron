"use client"

import { useParams } from "next/navigation"

import { BoundariesContainer } from "@/components/grade-projects/05-boundaries/BoundariesContainer"

export default function BoundariesPage() {
  const params = useParams()
  const gradeProjectId = params.gradeProjectId as string

  return <BoundariesContainer gradeProjectId={gradeProjectId} />
}
