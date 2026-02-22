"use client"

import { useParams } from "next/navigation"

import { SetupContainer } from "@/components/grade-projects/01-setup/SetupContainer"

export default function GradeProjectSetupPage() {
  const params = useParams()
  const gradeProjectId = params.gradeProjectId as string

  return <SetupContainer gradeProjectId={gradeProjectId} />
}
