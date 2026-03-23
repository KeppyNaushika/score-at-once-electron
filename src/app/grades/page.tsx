"use client"

import ProtectedRoute from "@/components/auth/ProtectedRoute"
import { GradeListContainer } from "@/components/grades/list/GradeListContainer"
import PageHeader from "@/components/layout/PageHeader"

export default function GradesPage() {
  return (
    <ProtectedRoute>
      <div className="flex h-full flex-col">
        <PageHeader title="成績算出" />
        <div className="flex-1 overflow-hidden">
          <GradeListContainer />
        </div>
      </div>
    </ProtectedRoute>
  )
}
