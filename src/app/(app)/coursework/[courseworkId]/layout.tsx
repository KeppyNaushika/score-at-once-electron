"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React from "react"

import type { WorkflowTab } from "@/components/common/WorkflowTabHeader"
import { WorkflowTabHeader } from "@/components/common/WorkflowTabHeader"
import { courseworkDetailQuery } from "@/queries/coursework"

const workflowTabs: readonly WorkflowTab[] = [
  { id: "detail", label: "概要", path: "" },
  { id: "02-students", label: "1. 生徒管理", path: "/02-students" },
  { id: "03-items", label: "2. 評価項目", path: "/03-items" },
  { id: "04-scores", label: "3. 点数入力", path: "/04-scores" },
  { id: "05-results", label: "4. 結果", path: "/05-results" },
]

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
        tabs={workflowTabs}
      />
      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
    </div>
  )
}
