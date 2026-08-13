"use client"

import { useParams } from "next/navigation"

import { CourseworkDetail } from "@/components/coursework/CourseworkDetail"

export default function CourseworkDetailPage() {
  const params = useParams()
  const courseworkId =
    typeof params.courseworkId === "string" ? params.courseworkId : ""

  return <CourseworkDetail courseworkId={courseworkId} />
}
