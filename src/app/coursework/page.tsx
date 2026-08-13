"use client"

import { CourseworkListContainer } from "@/components/coursework/list/CourseworkListContainer"
import PageHeader from "@/components/layout/PageHeader"

export default function CourseworkPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="試験外成績資料" />
      <div className="flex-1 overflow-hidden">
        <CourseworkListContainer />
      </div>
    </div>
  )
}
