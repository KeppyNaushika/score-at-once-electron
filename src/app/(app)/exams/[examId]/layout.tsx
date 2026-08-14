"use client"

import { useQuery } from "@tanstack/react-query"
import { Users } from "lucide-react"
import Head from "next/head"
import { useParams, usePathname } from "next/navigation"
import React, { useState } from "react"

import { GuardedLink } from "@/components/common/GuardedLink"
import { MemberInviteDialog } from "@/components/exams/shared/MemberInviteDialog"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { examDetailQuery } from "@/queries/exam"

// ワークフローステップの定義
const workflowSteps = [
  { id: "01-upload", label: "1. 模範解答", path: "01-upload" },
  { id: "02-template", label: "2. 採点領域", path: "02-template" },
  { id: "03-region-info", label: "3. 領域情報", path: "03-region-info" },
  { id: "04-question-group", label: "4. 小計点", path: "04-question-group" },
  { id: "05-students", label: "5. 受験生徒", path: "05-students" },
  {
    id: "06-student-answers",
    label: "6. 生徒答案",
    path: "06-student-answers",
  },
  { id: "07-score-at-once", label: "7. 採点", path: "07-score-at-once" },
  { id: "08-export", label: "8. 結果", path: "08-export" },
]

/** パンくずに出すのは試験名だけ（select の同一性を保つため外に置く） */
const selectExamName = (exam: { examName: string } | null) =>
  exam?.examName ?? ""

export default function ExamWorkflowLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const pathname = usePathname()
  const { user } = useAuth()
  const examId = typeof params.examId === "string" ? params.examId : ""
  const [showMemberDialog, setShowMemberDialog] = useState(false)

  // パンくずが要るのは試験名だけ
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
        <header className="flex items-center justify-between border-b bg-background px-4 py-3">
          <Breadcrumb>
            <BreadcrumbList>
              {workflowSteps.map((step, index) => {
                const isCurrentPage = pathname.includes(step.path)
                const linkHref = `/exams/${examId}/${step.path}`

                return (
                  <React.Fragment key={step.id}>
                    <BreadcrumbItem>
                      {isCurrentPage ? (
                        <BreadcrumbPage className="font-semibold text-green-600">
                          {step.label}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <GuardedLink href={linkHref}>
                            {step.label}
                          </GuardedLink>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {index < workflowSteps.length - 1 && (
                      <BreadcrumbSeparator />
                    )}
                  </React.Fragment>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>

          {/* 右側のナビゲーション要素 */}
          <div className="flex items-center space-x-2">
            {/* メンバー管理ボタン */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMemberDialog(true)}
            >
              <Users className="mr-2 h-4 w-4" />
              メンバー
            </Button>

            {/* 試験詳細に戻るボタン */}
            <Button variant="outline" size="sm" asChild>
              <GuardedLink href={`/exams/${examId}`}>試験詳細</GuardedLink>
            </Button>

            {/* 戻るボタン（採点画面でのみ表示） */}
            {pathname.includes("07-score-at-once") && (
              <Button variant="outline" size="sm" asChild>
                <GuardedLink href={`/exams/${examId}/06-student-answers`}>
                  戻る
                </GuardedLink>
              </Button>
            )}
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </div>

      {/* メンバー管理ダイアログ */}
      {user && (
        <MemberInviteDialog
          isOpen={showMemberDialog}
          onClose={() => setShowMemberDialog(false)}
          examId={examId}
          currentUserId={user.id}
          examName={examName}
        />
      )}
    </>
  )
}
