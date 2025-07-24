"use client"

import ProtectedRoute from "@/components/auth/ProtectedRoute"
import Projects from "@/components/projects/list/ProjectList"

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <Projects />
      </div>
    </ProtectedRoute>
  )
}
