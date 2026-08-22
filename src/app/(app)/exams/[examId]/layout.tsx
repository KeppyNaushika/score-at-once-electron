"use client"

import { useQuery } from "@tanstack/react-query"
import Head from "next/head"
import { useParams } from "next/navigation"
import React from "react"

import type { WorkflowTab } from "@/components/common/WorkflowTabHeader"
import { WorkflowTabHeader } from "@/components/common/WorkflowTabHeader"
import { examDetailQuery } from "@/queries/exam"

// ワークフローステップの定義
const workflowTabs: readonly WorkflowTab[] = [
  { id: "detail", label: "概要", path: "" },
  { id: "01-upload", label: "1. 模範解答", path: "/01-upload" },
  { id: "02-template", label: "2. 採点領域", path: "/02-template" },
  { id: "03-region-info", label: "3. 領域情報", path: "/03-region-info" },
  { id: "04-question-group", label: "4. 小計点", path: "/04-question-group" },
  { id: "05-students", label: "5. 受験生徒", path: "/05-students" },
  {
    id: "06-student-answers",
    label: "6. 生徒答案",
    path: "/06-student-answers",
  },
  { id: "07-score-at-once", label: "7. 採点", path: "/07-score-at-once" },
  { id: "08-export", label: "8. 結果", path: "/08-export" },
]

/** ヘッダーに出すのは試験名だけ（select の同一性を保つため外に置く） */
const selectExamName = (exam: { examName: string } | null) =>
  exam?.examName ?? ""

export default function ExamWorkflowLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const examId = typeof params.examId === "string" ? params.examId : ""

  // ヘッダーが要るのは試験名だけ
  const { data: examName = "" } = useQuery({
    ...examDetailQuery(examId),
    select: selectExamName,
  })

  return (
    <>
      <Head>
        <title>{examName || "試験"} - 一括採点</title>
      </Head>
      <div className="flex h-full flex-col">
        <WorkflowTabHeader
          listHref="/exams"
          entityName={examName || "試験"}
          entityHref={`/exams/${examId}`}
          tabs={workflowTabs}
        />
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </>
  )
}
