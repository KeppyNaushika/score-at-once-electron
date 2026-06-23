"use client"

import { useParams } from "next/navigation"

import { CourseworkSetupContainer } from "@/components/coursework/01-setup/CourseworkSetupContainer"

export default function CourseworkSetupPage() {
  const params = useParams()
  const courseworkId =
    typeof params.courseworkId === "string" ? params.courseworkId : ""

  return <CourseworkSetupContainer courseworkId={courseworkId} />
}
