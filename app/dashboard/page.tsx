'use client'

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
    router.push('/students')
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
        {/* Quick Actions */}
        <Card className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
          <CardHeader>
            <CardTitle className="text-white">クイックアクション</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Button 
                variant="outline" 
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                onClick={handleNewProject}
              >
                <Plus className="w-4 h-4 mr-2" />
                新規試験
              </Button>
              <Button 
                variant="outline" 
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                disabled
              >
                <Upload className="w-4 h-4 mr-2" />
                答案アップロード
              </Button>
              <Button 
                variant="outline" 
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                onClick={handleStudentManagement}
              >
                <Users className="w-4 h-4 mr-2" />
                生徒管理
              </Button>
              <Button 
                variant="outline" 
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                disabled
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                採点状況
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Projects List */}
        <Projects />
      </div>
    </ProtectedRoute>
  )
}
