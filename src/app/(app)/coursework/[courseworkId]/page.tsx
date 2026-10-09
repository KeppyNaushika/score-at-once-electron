"use client"

import { CourseworkDetail } from "@/components/coursework/CourseworkDetail"
import { useRouteParams } from "@/hooks/useRouteParams"

export default function CourseworkDetailPage() {
  const params = useRouteParams()
  const courseworkId = params.courseworkId ?? ""

  return <CourseworkDetail courseworkId={courseworkId} />
}
