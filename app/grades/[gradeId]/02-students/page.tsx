"use client"

import { useParams } from "next/navigation"

import { StudentsContainer } from "@/components/grades/02-students/StudentsContainer"

export default function StudentsPage() {
  const params = useParams()
  const gradeId = typeof params.gradeId === "string" ? params.gradeId : ""

  return <StudentsContainer gradeId={gradeId} />
}
