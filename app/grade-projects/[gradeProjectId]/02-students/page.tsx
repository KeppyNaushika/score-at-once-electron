"use client"

import { useParams } from "next/navigation"

import { StudentsContainer } from "@/components/grade-projects/02-students/StudentsContainer"

export default function StudentsPage() {
  const params = useParams()
  const gradeProjectId = params.gradeProjectId as string

  return <StudentsContainer gradeProjectId={gradeProjectId} />
}
