"use client"

import ProtectedRoute from "@/components/auth/ProtectedRoute"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import Projects from "@/components/projects/list/ProjectList"

export default function DashboardPage() {
  const { helpButton } = usePageHelp()

  return (
    <ProtectedRoute>
      <div className="flex h-full flex-col">
        <PageHeader title="ダッシュボード" helpButton={helpButton} />
        <div className="flex-1 overflow-hidden">
          <Projects />
        </div>
      </div>
    </ProtectedRoute>
  )
}
