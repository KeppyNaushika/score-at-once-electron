"use client"

import { redirect, useParams } from "next/navigation"

export default function CourseworkDetailPage() {
  const params = useParams()
  const courseworkId =
    typeof params.courseworkId === "string" ? params.courseworkId : ""

  redirect(`/coursework/${courseworkId}/01-setup`)
}
