"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React from "react"

import type { WorkflowTab } from "@/components/common/WorkflowTabHeader"
import { WorkflowTabHeader } from "@/components/common/WorkflowTabHeader"
import { gradeDetailQuery } from "@/queries/grade"

const workflowTabs: readonly WorkflowTab[] = [
  { id: "detail", label: "概要", path: "" },
  { id: "02-students", label: "1. 生徒管理", path: "/02-students" },
  { id: "03-data-sources", label: "2. データソース", path: "/03-data-sources" },
  {
    id: "04-manual-scores",
    label: "3. 外部成績",
    path: "/04-manual-scores",
  },
  { id: "05-boundaries", label: "4. 成績境界", path: "/05-boundaries" },
  { id: "06-results", label: "5. 結果", path: "/06-results" },
  { id: "07-export", label: "6. 出力", path: "/07-export" },
]

/** パンくずに出すのは名前だけ（select の同一性を保つため外に置く） */
const selectGradeName = (grade: { name: string }) => grade.name

export default function GradeWorkflowLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const gradeId = typeof params.gradeId === "string" ? params.gradeId : ""
  // パンくずが要るのは名前だけ。成績本体のキャッシュを各段階と共有する
  const { data: gradeName = "" } = useQuery({
    ...gradeDetailQuery(gradeId),
    select: selectGradeName,
  })

  return (
    <div className="flex h-full flex-col">
      <WorkflowTabHeader
        listHref="/grades"
        listLabel="成績算出"
        entityName={gradeName || "成績"}
        entityHref={`/grades/${gradeId}`}
        tabs={workflowTabs}
      />
      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
    </div>
  )
}
