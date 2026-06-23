"use client"

import { useParams } from "next/navigation"

import { CourseworkItemsContainer } from "@/components/coursework/03-items/CourseworkItemsContainer"

export default function CourseworkItemsPage() {
  const params = useParams()
  const courseworkId =
    typeof params.courseworkId === "string" ? params.courseworkId : ""

  return <CourseworkItemsContainer courseworkId={courseworkId} />
}
