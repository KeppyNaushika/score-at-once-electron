"use client"

import { CourseworkItemsContainer } from "@/components/coursework/03-items/CourseworkItemsContainer"
import { useRouteParams } from "@/hooks/useRouteParams"

export default function CourseworkItemsPage() {
  const params = useRouteParams()
  const courseworkId = params.courseworkId ?? ""

  return <CourseworkItemsContainer courseworkId={courseworkId} />
}
