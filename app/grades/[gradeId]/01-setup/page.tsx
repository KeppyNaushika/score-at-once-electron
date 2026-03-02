"use client"

import { useParams } from "next/navigation"

import { SetupContainer } from "@/components/grades/01-setup/SetupContainer"

export default function GradeSetupPage() {
  const params = useParams()
  const gradeId = params.gradeId as string

  return <SetupContainer gradeId={gradeId} />
}
