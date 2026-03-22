"use client"

import { useParams } from "next/navigation"

import { BoundariesContainer } from "@/components/grades/05-boundaries/BoundariesContainer"

export default function BoundariesPage() {
  const params = useParams()
  const gradeId = typeof params.gradeId === "string" ? params.gradeId : ""

  return <BoundariesContainer gradeId={gradeId} />
}
