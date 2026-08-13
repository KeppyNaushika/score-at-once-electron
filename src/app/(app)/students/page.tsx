"use client"

import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import StudentTable from "@/components/student/StudentTable"

export default function StudentsPage() {
  const { helpButton } = usePageHelp()

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="生徒管理" helpButton={helpButton} />
      <div className="flex-1 overflow-hidden">
        <StudentTable />
      </div>
    </div>
  )
}
