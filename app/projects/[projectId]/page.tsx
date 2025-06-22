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
  Tag
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import ProtectedRoute from "@/components/auth/ProtectedRoute"

interface ProjectData {
  id: string
  examName: string
  description?: string | null
  projectDate?: string | null
  subject?: string | null
  createdAt: string | Date
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
            <div>
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
                {project.projectDate && (
                  <Badge variant="outline">
                    <Calendar className="h-3 w-3 mr-1" />
                    {new Date(project.projectDate).toLocaleDateString()}
                  </Badge>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm">
              <Edit className="h-4 w-4 mr-2" />
              編集
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center">
                <FileImage className="h-4 w-4 mr-2" />
                模範解答
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{masterImageCount}</div>
              <p className="text-xs text-muted-foreground">ページ</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center">
                <Upload className="h-4 w-4 mr-2" />
                答案
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{answerSheetCount}</div>
              <p className="text-xs text-muted-foreground">アップロード済み</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center">
                <Settings className="h-4 w-4 mr-2" />
                採点領域
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{layoutRegionCount}</div>
              <p className="text-xs text-muted-foreground">定義済み</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center">
                <BarChart3 className="h-4 w-4 mr-2" />
                進捗
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0%</div>
              <p className="text-xs text-muted-foreground">採点完了</p>
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
              
              <Link href={`/projects/${projectId}/answer-sheets`}>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center">
                    <Upload className="h-4 w-4 mr-2" />
                    答案アップロード・管理
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
              <Link href={`/projects/${projectId}/score`}>
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
                      各設問の採点範囲や配点を設定します
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className={`flex items-center justify-center w-6 h-6 rounded-full text-sm font-medium ${
                    answerSheetCount > 0 ? 'bg-green-500 text-white' : layoutRegionCount > 0 ? 'bg-primary text-primary-foreground' : 'bg-gray-300 text-gray-600'
                  }`}>
                    3
                  </span>
                  <div>
                    <p className="font-medium">生徒答案のアップロード</p>
                    <p className="text-sm text-muted-foreground">
                      スキャンした生徒の答案画像をアップロードします
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className={`flex items-center justify-center w-6 h-6 rounded-full text-sm font-medium ${
                    answerSheetCount > 0 && layoutRegionCount > 0 ? 'bg-primary text-primary-foreground' : 'bg-gray-300 text-gray-600'
                  }`}>
                    4
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
      </div>
    </ProtectedRoute>
  )
}