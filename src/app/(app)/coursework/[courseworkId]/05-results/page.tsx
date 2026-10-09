"use client"

import { CourseworkResultsContainer } from "@/components/coursework/05-results/CourseworkResultsContainer"
import { useRouteParams } from "@/hooks/useRouteParams"

export default function CourseworkResultsPage() {
  const params = useRouteParams()
  const courseworkId = params.courseworkId ?? ""

  return <CourseworkResultsContainer courseworkId={courseworkId} />
}
