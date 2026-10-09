"use client"

import { useQuery } from "@tanstack/react-query"
import React from "react"

import { GradeLockBar } from "@/components/common/grade-lock/GradeLockBar"
import { GradeLockProvider } from "@/components/common/grade-lock/GradeLockProvider"
import { WorkflowTabHeader } from "@/components/common/WorkflowTabHeader"
import { useRouteParams } from "@/hooks/useRouteParams"
import { courseworkWorkflowTabs } from "@/lib/workflowTabs"
import { courseworkDetailQuery } from "@/queries/coursework"

/** ヘッダーに出すのは名前だけ（select の同一性を保つため外に置く） */
const selectCourseworkName = (coursework: { name: string }) => coursework.name

export default function CourseworkWorkflowLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useRouteParams()
  const courseworkId = params.courseworkId ?? ""
  // ヘッダーが要るのは名前だけ。資料そのもののキャッシュを概要画面と共有する
  const { data: courseworkName = "" } = useQuery({
    ...courseworkDetailQuery(courseworkId),
    select: selectCourseworkName,
  })

  return (
    // 成績算出で使われている資料は、全タブの書き込みをまとめてロックする
    // （解除の持ち方は試験の layout と同じ）
    <GradeLockProvider
      key={courseworkId}
      target={{ kind: "coursework", courseworkId }}
    >
      <div className="flex h-full flex-col">
        <WorkflowTabHeader
          listHref="/coursework"
          entityName={courseworkName || "試験外成績資料"}
          entityHref={`/coursework/${courseworkId}`}
          tabs={courseworkWorkflowTabs}
        />
        <GradeLockBar />
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </GradeLockProvider>
  )
}
