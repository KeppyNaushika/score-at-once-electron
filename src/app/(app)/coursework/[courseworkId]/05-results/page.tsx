"use client"

import { useParams } from "next/navigation"

import { CourseworkResultsContainer } from "@/components/coursework/05-results/CourseworkResultsContainer"

export default function CourseworkResultsPage() {
  const params = useParams()
  const courseworkId =
    typeof params.courseworkId === "string" ? params.courseworkId : ""

  return <CourseworkResultsContainer courseworkId={courseworkId} />
}
