"use client"

import { useParams } from "next/navigation"

import { CourseworkStudentsContainer } from "@/components/coursework/02-students/CourseworkStudentsContainer"

export default function CourseworkStudentsPage() {
  const params = useParams()
  const courseworkId =
    typeof params.courseworkId === "string" ? params.courseworkId : ""

  return <CourseworkStudentsContainer courseworkId={courseworkId} />
}
