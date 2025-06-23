"use client"

import ProtectedRoute from "@/components/auth/ProtectedRoute"
import { useFileActions } from "@/components/hooks/useFileActions"
import Projects from "@/components/project/list/ProjectList"
import { useRouter } from "next/navigation"

export default function DashboardPage() {
  const router = useRouter()
  const { createProjectModal } = useFileActions()

  const handleNewProject = () => {
    createProjectModal.open()
  }

  const handleStudentManagement = () => {
    router.push("/students")
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        <Projects />
      </div>
    </ProtectedRoute>
  )
}
