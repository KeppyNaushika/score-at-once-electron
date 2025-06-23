"use client"

import { useRouter } from "next/navigation"
import ProtectedRoute from "@/components/auth/ProtectedRoute"
import Projects from "@/components/project/list/ProjectList"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Upload, Users, BarChart3 } from "lucide-react"
import { useFileActions } from "@/components/hooks/useFileActions"

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
