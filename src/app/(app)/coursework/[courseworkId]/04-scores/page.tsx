"use client"

import { CourseworkScoresContainer } from "@/components/coursework/04-scores/CourseworkScoresContainer"
import { useRouteParams } from "@/hooks/useRouteParams"

export default function CourseworkScoresPage() {
  const params = useRouteParams()
  const courseworkId = params.courseworkId ?? ""

  return <CourseworkScoresContainer courseworkId={courseworkId} />
}
