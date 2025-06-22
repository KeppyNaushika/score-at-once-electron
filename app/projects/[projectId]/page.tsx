"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import Link from "next/link"
import { toast } from "sonner"
import { 
  Upload, 
  Edit, 
  FileImage, 
  Users, 
  Settings, 
  BarChart3,
  ChevronRight,
  Calendar,
  Tag,
  Trash2,
  MoreVertical,
  Info
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import ProtectedRoute from "@/components/auth/ProtectedRoute"
import EditProjectWindow from "@/components/project/forms/EditProjectWindow"
import DeleteProjectModal from "@/components/project/DeleteProjectModal"

interface ProjectData {
  id: string
  examName: string
  description: string | null
  examDate: Date | null
  subject: string | null
  createdAt: Date
  updatedAt: Date
  userId: string
  masterImages?: any[]
  answerSheets?: any[]
  layoutRegions?: any[]
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const projectId = params.projectId as string

  const [project, setProject] = useState<ProjectData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const loadProject = async () => {
    if (!projectId) return

    try {
      setIsLoading(true)
      const result = await window.electronAPI.fetchProjectById(projectId)
      
      if (result) {
        setProject(result)
      } else {
        toast.error('プロジェクトが見つかりません')
        router.push('/')
      }
    } catch (error) {
      console.error('Error loading project:', error)
      toast.error('プロジェクトの読み込みに失敗しました')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadProject()
  }, [projectId])

  const handleProjectUpdated = async (updatedProjectData: any) => {
    try {
      const updatedProject = await window.electronAPI.updateProject(
        project!.id,
        {
          examName: updatedProjectData.examName,
          description: updatedProjectData.description,
          examDate: updatedProjectData.examDate,
          subject: updatedProjectData.subject,
        }
      )
      setProject(updatedProject)
      setShowEditModal(false)
      toast.success("プロジェクトを更新しました")
    } catch (error) {
      console.error("Failed to update project:", error)
      toast.error("プロジェクトの更新に失敗しました")
    }
  }

  const handleProjectDeleted = () => {
    router.push('/projects')
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">読み込み中...</p>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  if (!project) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">プロジェクトが見つかりません</h1>
            <Button onClick={() => router.push('/')}>
              プロジェクト一覧に戻る
            </Button>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  const masterImageCount = project.masterImages?.length || 0
  const answerSheetCount = project.answerSheets?.length || 0
  const layoutRegionCount = project.layoutRegions?.length || 0

  return (
    <ProtectedRoute>
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold">{project.examName}</h1>
              {project.description && (
                <p className="text-muted-foreground mt-2">{project.description}</p>
              )}
              <div className="flex items-center gap-4 mt-3">
                {project.subject && (
                  <Badge variant="outline">
                    <Tag className="h-3 w-3 mr-1" />
                    {project.subject}
                  </Badge>
                )}
                {project.examDate && (
                  <Badge variant="outline">
                    <Calendar className="h-3 w-3 mr-1" />
                    {new Date(project.examDate).toLocaleDateString()}
                  </Badge>
                )}
                <Badge variant="secondary">
                  作成日: {new Date(project.createdAt).toLocaleDateString()}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditModal(true)}
              >
                <Edit className="h-4 w-4 mr-2" />
                編集
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowEditModal(true)}>
                    <Edit className="h-4 w-4 mr-2" />
                    プロジェクトを編集
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/projects/${projectId}/score`}>
                      <Info className="h-4 w-4 mr-2" />
                      プロジェクト設定
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteModal(true)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    プロジェクトを削除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center">
                <FileImage className="h-4 w-4 mr-2 text-blue-500" />
                模範解答
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{masterImageCount}</div>
              <p className="text-xs text-muted-foreground">
                {masterImageCount > 0 ? "ページアップロード済み" : "未アップロード"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center">
                <Settings className="h-4 w-4 mr-2 text-green-500" />
                採点領域
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{layoutRegionCount}</div>
              <p className="text-xs text-muted-foreground">
                {layoutRegionCount > 0 ? "領域定義済み" : "未設定"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center">
                <Upload className="h-4 w-4 mr-2 text-orange-500" />
                答案
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{answerSheetCount}</div>
              <p className="text-xs text-muted-foreground">
                {answerSheetCount > 0 ? "件アップロード済み" : "未アップロード"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center">
                <BarChart3 className="h-4 w-4 mr-2 text-purple-500" />
                採点進捗
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0%</div>
              <p className="text-xs text-muted-foreground">
                未実装（採点機能開発中）
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>プロジェクト設定</CardTitle>
              <CardDescription>
                試験の基本設定と模範解答の管理
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href={`/projects/${projectId}/score`}>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center">
                    <FileImage className="h-4 w-4 mr-2" />
                    模範解答アップロード
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              
              <Link href={`/projects/${projectId}/score/template`}>
                <Button 
                  variant="outline" 
                  className="w-full justify-between"
                  disabled={masterImageCount === 0}
                >
                  <span className="flex items-center">
                    <Settings className="h-4 w-4 mr-2" />
                    採点領域設定
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              
              <Link href={`/projects/${projectId}/score/region-info`}>
                <Button 
                  variant="outline" 
                  className="w-full justify-between"
                  disabled={layoutRegionCount === 0}
                >
                  <span className="flex items-center">
                    <Edit className="h-4 w-4 mr-2" />
                    領域情報編集
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              
              <Link href={`/projects/${projectId}/score/students`}>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center">
                    <Users className="h-4 w-4 mr-2" />
                    受験生徒管理
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              
              <Link href={`/projects/${projectId}/score/upload`}>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center">
                    <Upload className="h-4 w-4 mr-2" />
                    生徒解答アップロード
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>採点作業</CardTitle>
              <CardDescription>
                答案の採点と結果の管理
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href={`/projects/${projectId}/score/scoring`}>
                <Button 
                  variant="outline" 
                  className="w-full justify-between"
                  disabled={answerSheetCount === 0 || layoutRegionCount === 0}
                >
                  <span className="flex items-center">
                    <Edit className="h-4 w-4 mr-2" />
                    採点開始
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              
              <Link href={`/projects/${projectId}/score/results`}>
                <Button 
                  variant="outline" 
                  className="w-full justify-between"
                  disabled={true}
                >
                  <span className="flex items-center">
                    <BarChart3 className="h-4 w-4 mr-2" />
                    結果分析・出力
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {masterImageCount === 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>開始手順</CardTitle>
              <CardDescription>
                採点を始めるための準備手順
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className={`flex items-center justify-center w-6 h-6 rounded-full text-sm font-medium ${
                    masterImageCount > 0 ? 'bg-green-500 text-white' : 'bg-primary text-primary-foreground'
                  }`}>
                    1
                  </span>
                  <div>
                    <p className="font-medium">模範解答のアップロード</p>
                    <p className="text-sm text-muted-foreground">
                      試験問題の模範解答画像をアップロードします
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className={`flex items-center justify-center w-6 h-6 rounded-full text-sm font-medium ${
                    layoutRegionCount > 0 ? 'bg-green-500 text-white' : masterImageCount > 0 ? 'bg-primary text-primary-foreground' : 'bg-gray-300 text-gray-600'
                  }`}>
                    2
                  </span>
                  <div>
                    <p className="font-medium">採点領域の設定</p>
                    <p className="text-sm text-muted-foreground">
                      各設問の採点範囲を設定します
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className={`flex items-center justify-center w-6 h-6 rounded-full text-sm font-medium ${
                    layoutRegionCount > 0 ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                  }`}>
                    3
                  </span>
                  <div>
                    <p className="font-medium">領域情報の編集</p>
                    <p className="text-sm text-muted-foreground">
                      各領域の種類、配点、ラベルを設定します
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className={`flex items-center justify-center w-6 h-6 rounded-full text-sm font-medium ${
                    layoutRegionCount > 0 ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                  }`}>
                    4
                  </span>
                  <div>
                    <p className="font-medium">受験生徒の確認</p>
                    <p className="text-sm text-muted-foreground">
                      プロジェクトに参加する生徒を管理します
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className={`flex items-center justify-center w-6 h-6 rounded-full text-sm font-medium ${
                    answerSheetCount > 0 ? 'bg-green-500 text-white' : layoutRegionCount > 0 ? 'bg-primary text-primary-foreground' : 'bg-gray-300 text-gray-600'
                  }`}>
                    5
                  </span>
                  <div>
                    <p className="font-medium">生徒解答のアップロード</p>
                    <p className="text-sm text-muted-foreground">
                      スキャンした生徒の答案画像をアップロードします
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className={`flex items-center justify-center w-6 h-6 rounded-full text-sm font-medium ${
                    answerSheetCount > 0 && layoutRegionCount > 0 ? 'bg-primary text-primary-foreground' : 'bg-gray-300 text-gray-600'
                  }`}>
                    6
                  </span>
                  <div>
                    <p className="font-medium">採点開始</p>
                    <p className="text-sm text-muted-foreground">
                      準備が完了したら採点を開始できます
                    </p>
                  </div>
                </li>
              </ol>
            </CardContent>
          </Card>
        )}

        {/* Modals */}
        {project && showEditModal && (
          <EditProjectWindow
            projectToEdit={project}
            setIsShowEditProjectWindow={setShowEditModal}
            onSave={handleProjectUpdated}
          />
        )}
        {project && (
          <DeleteProjectModal
            project={project}
            open={showDeleteModal}
            onOpenChange={setShowDeleteModal}
            onProjectDeleted={handleProjectDeleted}
          />
        )}
      </div>
    </ProtectedRoute>
  )
}