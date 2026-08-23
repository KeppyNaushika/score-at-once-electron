"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React from "react"

import { WorkflowTabHeader } from "@/components/common/WorkflowTabHeader"
import { gradeWorkflowTabs } from "@/lib/workflowTabs"
import { gradeDetailQuery } from "@/queries/grade"

/** ヘッダーに出すのは名前だけ（select の同一性を保つため外に置く） */
const selectGradeName = (grade: { name: string }) => grade.name

export default function GradeWorkflowLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const gradeId = typeof params.gradeId === "string" ? params.gradeId : ""
  // ヘッダーが要るのは名前だけ。成績本体のキャッシュを各段階と共有する
  const { data: gradeName = "" } = useQuery({
    ...gradeDetailQuery(gradeId),
    select: selectGradeName,
  })

  return (
    <div className="flex h-full flex-col">
      <WorkflowTabHeader
        listHref="/grades"
        entityName={gradeName || "成績"}
        entityHref={`/grades/${gradeId}`}
        tabs={gradeWorkflowTabs}
      />
      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
    </div>
  )
}
