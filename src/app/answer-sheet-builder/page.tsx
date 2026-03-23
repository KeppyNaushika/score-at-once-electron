"use client"

import { AnswerSheetDefinitionList } from "@/components/answer-sheet-builder/AnswerSheetDefinitionList"
import ProtectedRoute from "@/components/auth/ProtectedRoute"
import PageHeader from "@/components/layout/PageHeader"

export default function AnswerSheetBuilderPage() {
  return (
    <ProtectedRoute>
      <div className="flex h-full flex-col">
        <PageHeader title="解答用紙作成" />
        <div className="flex-1 overflow-hidden">
          <AnswerSheetDefinitionList />
        </div>
      </div>
    </ProtectedRoute>
  )
}
