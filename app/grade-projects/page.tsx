"use client"

import { GradeProjectListContainer } from "@/components/grade-projects/list/GradeProjectListContainer"
import PageHeader from "@/components/layout/PageHeader"

export default function GradeProjectsPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title="成績算出" />
      <div className="flex-1 overflow-hidden">
        <GradeProjectListContainer />
      </div>
    </div>
  )
}
