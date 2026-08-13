"use client"

import ClassroomManagementTable from "@/components/classroom/ClassroomManagementTable"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"

export default function ClassroomsPage() {
  const { helpButton } = usePageHelp()

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="学級管理" helpButton={helpButton} />
      <div className="flex-1 overflow-hidden">
        <ClassroomManagementTable />
      </div>
    </div>
  )
}
