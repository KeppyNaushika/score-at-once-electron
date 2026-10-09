"use client"

import { StudentsContainer } from "@/components/grades/01-students/StudentsContainer"
import { useRouteParams } from "@/hooks/useRouteParams"

export default function StudentsPage() {
  const params = useRouteParams()
  const gradeId = params.gradeId ?? ""

  return <StudentsContainer gradeId={gradeId} />
}
