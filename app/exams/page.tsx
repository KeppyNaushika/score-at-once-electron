"use client"

import ProtectedRoute from "@/components/auth/ProtectedRoute"
import Exams from "@/components/exams/list/ExamList"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"

export default function ExamsPage() {
  const { helpButton } = usePageHelp()

  return (
    <ProtectedRoute>
      <div className="flex h-full flex-col">
        <PageHeader title="試験一覧" helpButton={helpButton} />
        <div className="flex-1 overflow-hidden">
          <Exams />
        </div>
      </div>
    </ProtectedRoute>
  )
}
