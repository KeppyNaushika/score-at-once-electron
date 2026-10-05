"use client"

import { useQuery } from "@tanstack/react-query"
import Head from "next/head"
import { useParams } from "next/navigation"
import React from "react"

import { GradeLockBar } from "@/components/common/grade-lock/GradeLockBar"
import { GradeLockProvider } from "@/components/common/grade-lock/GradeLockProvider"
import { WorkflowTabHeader } from "@/components/common/WorkflowTabHeader"
import { ExamStepGuard } from "@/components/exams/shared/ExamStepGuard"
import { useExamAccess } from "@/components/exams/shared/useExamAccess"
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
  // ロールで入れる段だけをタブに出し、入れない段は中身の代わりに理由を出す（§3-3）
  const access = useExamAccess(examId)

  return (
    <>
      <Head>
        <title>{examName || "試験"} - 一括採点</title>
      </Head>
      {/*
        成績算出で使われている試験は、全タブの書き込みをまとめてロックする。
        解除はこの layout の state なので、タブを移っても続き、試験を出ると戻る。
        別の試験へ直接移ったときも解除を持ち越さないよう、試験ごとに作り直す
      */}
      <GradeLockProvider key={examId} target={{ kind: "exam", examId }}>
        <div className="flex h-full flex-col">
          <WorkflowTabHeader
            listHref="/exams"
            entityName={examName || "試験"}
            entityHref={`/exams/${examId}`}
            tabs={access.tabs}
          />
          <GradeLockBar />
          <main className="min-h-0 flex-1 overflow-auto">
            <ExamStepGuard
              examId={examId}
              isPending={access.isPending}
              role={access.role}
              allowedTabs={access.tabs}
            >
              {children}
            </ExamStepGuard>
          </main>
        </div>
      </GradeLockProvider>
    </>
  )
}
