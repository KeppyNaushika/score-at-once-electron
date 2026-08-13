"use client"

import { useParams } from "next/navigation"

import { CourseworkScoresContainer } from "@/components/coursework/04-scores/CourseworkScoresContainer"

export default function CourseworkScoresPage() {
  const params = useParams()
  const courseworkId =
    typeof params.courseworkId === "string" ? params.courseworkId : ""

  return <CourseworkScoresContainer courseworkId={courseworkId} />
}
