"use client"

import { useQuery } from "@tanstack/react-query"
import Head from "next/head"
import { useParams } from "next/navigation"
import React from "react"

import { WorkflowTabHeader } from "@/components/common/WorkflowTabHeader"
import { examWorkflowTabs } from "@/lib/workflowTabs"
import { examDetailQuery } from "@/queries/exam"

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
          tabs={examWorkflowTabs}
        />
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>
    </>
  )
}
