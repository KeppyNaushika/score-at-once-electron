"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React from "react"

import { WorkflowTabHeader } from "@/components/common/WorkflowTabHeader"
import { courseworkWorkflowTabs } from "@/lib/workflowTabs"
import { courseworkDetailQuery } from "@/queries/coursework"

/** ヘッダーに出すのは名前だけ（select の同一性を保つため外に置く） */
const selectCourseworkName = (coursework: { name: string }) => coursework.name

export default function CourseworkWorkflowLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const courseworkId =
    typeof params.courseworkId === "string" ? params.courseworkId : ""
  // ヘッダーが要るのは名前だけ。資料そのもののキャッシュを概要画面と共有する
  const { data: courseworkName = "" } = useQuery({
    ...courseworkDetailQuery(courseworkId),
    select: selectCourseworkName,
  })

  return (
    <div className="flex h-full flex-col">
      <WorkflowTabHeader
        listHref="/coursework"
        entityName={courseworkName || "試験外成績資料"}
        entityHref={`/coursework/${courseworkId}`}
        tabs={courseworkWorkflowTabs}
      />
      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
    </div>
  )
}
