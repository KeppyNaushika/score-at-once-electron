"use client"

import { CourseworkStudentsContainer } from "@/components/coursework/02-students/CourseworkStudentsContainer"
import { useRouteParams } from "@/hooks/useRouteParams"

export default function CourseworkStudentsPage() {
  const params = useRouteParams()
  const courseworkId = params.courseworkId ?? ""

  return <CourseworkStudentsContainer courseworkId={courseworkId} />
}
