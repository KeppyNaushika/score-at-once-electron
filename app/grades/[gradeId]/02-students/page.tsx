"use client"

import { useParams } from "next/navigation"

import { StudentsContainer } from "@/components/grades/02-students/StudentsContainer"

export default function StudentsPage() {
  const params = useParams()
  const gradeId = params.gradeId as string

  return <StudentsContainer gradeId={gradeId} />
}
