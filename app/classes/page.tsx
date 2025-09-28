"use client"

import ProtectedRoute from "@/components/auth/ProtectedRoute"
import ClassManagementTable from "@/components/class/ClassManagementTable"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"

export default function ClassesPage() {
  const { helpButton } = usePageHelp()

  return (
    <ProtectedRoute>
      <div className="flex h-full flex-col">
        <PageHeader title="学級管理" helpButton={helpButton} />
        <div className="flex-1 overflow-hidden p-6">
          <ClassManagementTable />
        </div>
      </div>
    </ProtectedRoute>
  )
}