"use client"

import ProtectedRoute from "@/components/auth/ProtectedRoute"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import StudentTable from "@/components/student/StudentTable"

export default function StudentsPage() {
  const { helpButton } = usePageHelp()

  return (
    <ProtectedRoute>
      <div className="flex h-full flex-col">
        <PageHeader title="生徒管理" helpButton={helpButton} />
        <div className="flex-1 overflow-hidden">
          <StudentTable />
        </div>
      </div>
    </ProtectedRoute>
  )
}
