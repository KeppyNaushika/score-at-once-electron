"use client"

import { useParams } from "next/navigation"

import { SetupContainer } from "@/components/grades/01-setup/SetupContainer"

export default function GradeSetupPage() {
  const params = useParams()
  const gradeId = typeof params.gradeId === "string" ? params.gradeId : ""

  return <SetupContainer gradeId={gradeId} />
}
