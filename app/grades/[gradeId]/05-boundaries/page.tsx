"use client"

import { useParams } from "next/navigation"

import { BoundariesContainer } from "@/components/grades/05-boundaries/BoundariesContainer"

export default function BoundariesPage() {
  const params = useParams()
  const gradeId = params.gradeId as string

  return <BoundariesContainer gradeId={gradeId} />
}
