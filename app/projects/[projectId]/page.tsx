"use client"

import ProtectedRoute from "@/components/auth/ProtectedRoute"
import DeleteProjectModal from "@/components/project/DeleteProjectModal"
import EditProjectWindow from "@/components/project/forms/EditProjectWindow"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/contexts/AuthContext"
import {
  BarChart3,
  Calendar,
  ChevronRight,
  Edit,
  FileImage,
  Info,
  MoreVertical,
  Settings,
  Tag,
  Trash2,
  Upload,
  Users,
} from "lucide-react"
import Link from "next/link"
import Head from "next/head"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"

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
  const [studentCount, setStudentCount] = useState(0)
  const [questionRegionCount, setQuestionRegionCount] = useState(0)

  const loadProject = async () => {
    if (!projectId) return

    try {
      setIsLoading(true)
      const result = await window.electronAPI.fetchProjectById(projectId)

      if (result) {
        setProject(result)
        
        // 生徒数を取得
        const studentsResult = await window.electronAPI.getStudentsForProject(projectId)
        if (studentsResult.success) {
          setStudentCount(studentsResult.students?.length || 0)
        }

        // 設問領域数を取得
        const regionsResult = await window.electronAPI.getLayoutRegionsByProjectId(projectId)
        if (Array.isArray(regionsResult)) {
          const questionRegions = regionsResult.filter(
            region => region.type === "QUESTION_ANSWER" && region.questionNumber
          )
          setQuestionRegionCount(questionRegions.length)
        }
      } else {
        toast.error("プロジェクトが見つかりません")
        router.push("/")
      }
    } catch (error) {
      console.error("Error loading project:", error)
      toast.error("プロジェクトの読み込みに失敗しました")
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
        },
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
    router.push("/projects")
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <div className="border-primary mx-auto h-12 w-12 animate-spin rounded-full border-b-2"></div>
            <p className="text-muted-foreground mt-4">読み込み中...</p>
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
            <h1 className="mb-4 text-2xl font-bold">
              プロジェクトが見つかりません
            </h1>
            <Button onClick={() => router.push("/")}>
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
      <Head>
        <title>
          {project?.examName || "プロジェクト"} - 一括採点
        </title>
      </Head>
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold">{project.examName}</h1>
              {project.description && (
                <p className="text-muted-foreground mt-2">
                  {project.description}
                </p>
              )}
              <div className="mt-3 flex items-center gap-4">
                {project.subject && (
                  <Badge variant="outline">
                    <Tag className="mr-1 h-3 w-3" />
                    {project.subject}
                  </Badge>
                )}
                {project.examDate && (
                  <Badge variant="outline">
                    <Calendar className="mr-1 h-3 w-3" />
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
                <Edit className="mr-2 h-4 w-4" />
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
                    <Edit className="mr-2 h-4 w-4" />
                    プロジェクトを編集
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href={`/projects/${projectId}/score`}>
                      <Info className="mr-2 h-4 w-4" />
                      プロジェクト設定
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteModal(true)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    プロジェクトを削除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-sm">
                <FileImage className="mr-2 h-4 w-4 text-blue-500" />
                模範解答
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{masterImageCount}</div>
              <p className="text-muted-foreground text-xs">
                {masterImageCount > 0
                  ? "ページアップロード済み"
                  : "未アップロード"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-sm">
                <Settings className="mr-2 h-4 w-4 text-green-500" />
                採点領域
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{layoutRegionCount}</div>
              <p className="text-muted-foreground text-xs">
                {layoutRegionCount > 0 ? "領域定義済み" : "未設定"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-sm">
                <Edit className="mr-2 h-4 w-4 text-indigo-500" />
                設問領域
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{questionRegionCount}</div>
              <p className="text-muted-foreground text-xs">
                {questionRegionCount > 0 ? "設問領域設定済み" : "未設定"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-sm">
                <Users className="mr-2 h-4 w-4 text-purple-500" />
                受験生徒
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{studentCount}</div>
              <p className="text-muted-foreground text-xs">
                {studentCount > 0 ? "名登録済み" : "未登録"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center text-sm">
                <Upload className="mr-2 h-4 w-4 text-orange-500" />
                答案
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{answerSheetCount}</div>
              <p className="text-muted-foreground text-xs">
                {answerSheetCount > 0 ? "件アップロード済み" : "未アップロード"}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>セットアップワークフロー</CardTitle>
              <CardDescription>採点準備のための6段階のステップ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Step 1: 模範解答アップロード */}
              <Link href={`/projects/${projectId}/01-upload`}>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center">
                    <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-600">
                      1
                    </span>
                    <FileImage className="mr-2 h-4 w-4" />
                    模範解答アップロード
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>

              {/* Step 2: 採点領域作成 */}
              <Link href={`/projects/${projectId}/02-template`}>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  disabled={masterImageCount === 0}
                >
                  <span className={`flex items-center ${masterImageCount === 0 ? 'opacity-50' : ''}`}>
                    <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-xs font-medium text-green-600">
                      2
                    </span>
                    <Settings className="mr-2 h-4 w-4" />
                    採点領域作成
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>

              {/* Step 3: 領域情報編集 */}
              <Link href={`/projects/${projectId}/03-region-info`}>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  disabled={layoutRegionCount === 0}
                >
                  <span className={`flex items-center ${layoutRegionCount === 0 ? 'opacity-50' : ''}`}>
                    <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-xs font-medium text-indigo-600">
                      3
                    </span>
                    <Edit className="mr-2 h-4 w-4" />
                    領域情報編集
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>

              {/* Step 4: 受験生徒管理 */}
              <Link href={`/projects/${projectId}/04-students`}>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  disabled={questionRegionCount === 0}
                >
                  <span className={`flex items-center ${questionRegionCount === 0 ? 'opacity-50' : ''}`}>
                    <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-xs font-medium text-purple-600">
                      4
                    </span>
                    <Users className="mr-2 h-4 w-4" />
                    受験生徒管理
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>

              {/* Step 5: 答案アップロード */}
              <Link href={`/projects/${projectId}/05-answer-sheets`}>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  disabled={studentCount === 0}
                >
                  <span className={`flex items-center ${studentCount === 0 ? 'opacity-50' : ''}`}>
                    <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-xs font-medium text-orange-600">
                      5
                    </span>
                    <Upload className="mr-2 h-4 w-4" />
                    答案アップロード
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>

              {/* Step 6: 採点実行 */}
              <Link href={`/projects/${projectId}/06-score-at-once`}>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  disabled={answerSheetCount === 0 || questionRegionCount === 0}
                >
                  <span className={`flex items-center ${answerSheetCount === 0 || questionRegionCount === 0 ? 'opacity-50' : ''}`}>
                    <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs font-medium text-red-600">
                      6
                    </span>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    採点実行
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>追加機能</CardTitle>
              <CardDescription>結果出力とプロジェクト管理</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* 結果出力（未実装） */}
              <Button
                variant="outline"
                className="w-full justify-between"
                disabled={true}
              >
                <span className="flex items-center opacity-50">
                  <span className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                    7
                  </span>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  結果分析・出力
                </span>
                <ChevronRight className="h-4 w-4" />
              </Button>

              {/* 設定アクセス */}
              <Link href={`/projects/${projectId}/01-upload`}>
                <Button variant="ghost" className="w-full justify-between">
                  <span className="flex items-center">
                    <Info className="mr-2 h-4 w-4" />
                    プロジェクト設定を開く
                  </span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>

              {/* 次のステップガイド */}
              <div className="mt-4 rounded-lg bg-muted/50 p-4">
                <h4 className="font-medium text-sm mb-2">次に進むべきステップ</h4>
                <p className="text-muted-foreground text-xs">
                  {masterImageCount === 0 && "まず模範解答をアップロードしてください"}
                  {masterImageCount > 0 && layoutRegionCount === 0 && "採点領域を作成してください"}
                  {layoutRegionCount > 0 && questionRegionCount === 0 && "領域情報を編集してください"}
                  {questionRegionCount > 0 && studentCount === 0 && "受験生徒を登録してください"}
                  {studentCount > 0 && answerSheetCount === 0 && "答案をアップロードしてください"}
                  {answerSheetCount > 0 && questionRegionCount > 0 && "採点を開始できます"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>ワークフロー進捗</CardTitle>
            <CardDescription>6段階の採点準備プロセス</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              <li className="flex items-start gap-3">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-sm font-medium ${
                    masterImageCount > 0
                      ? "bg-green-500 text-white"
                      : "bg-blue-100 text-blue-600"
                  }`}
                >
                  1
                </span>
                <div>
                  <p className="font-medium">模範解答のアップロード</p>
                  <p className="text-muted-foreground text-sm">
                    試験問題の模範解答画像をアップロードします
                    {masterImageCount > 0 && ` (${masterImageCount}ページ完了)`}
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-sm font-medium ${
                    layoutRegionCount > 0
                      ? "bg-green-500 text-white"
                      : masterImageCount > 0
                        ? "bg-green-100 text-green-600"
                        : "bg-gray-300 text-gray-600"
                  }`}
                >
                  2
                </span>
                <div>
                  <p className="font-medium">採点領域の作成</p>
                  <p className="text-muted-foreground text-sm">
                    各設問の採点範囲を設定します
                    {layoutRegionCount > 0 && ` (${layoutRegionCount}領域作成済み)`}
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-sm font-medium ${
                    questionRegionCount > 0
                      ? "bg-green-500 text-white"
                      : layoutRegionCount > 0
                        ? "bg-indigo-100 text-indigo-600"
                        : "bg-gray-300 text-gray-600"
                  }`}
                >
                  3
                </span>
                <div>
                  <p className="font-medium">領域情報の編集</p>
                  <p className="text-muted-foreground text-sm">
                    各領域の種類、配点、ラベルを設定します
                    {questionRegionCount > 0 && ` (${questionRegionCount}設問定義済み)`}
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-sm font-medium ${
                    studentCount > 0
                      ? "bg-green-500 text-white"
                      : questionRegionCount > 0
                        ? "bg-purple-100 text-purple-600"
                        : "bg-gray-300 text-gray-600"
                  }`}
                >
                  4
                </span>
                <div>
                  <p className="font-medium">受験生徒の管理</p>
                  <p className="text-muted-foreground text-sm">
                    プロジェクトに参加する生徒を管理します
                    {studentCount > 0 && ` (${studentCount}名登録済み)`}
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-sm font-medium ${
                    answerSheetCount > 0
                      ? "bg-green-500 text-white"
                      : studentCount > 0
                        ? "bg-orange-100 text-orange-600"
                        : "bg-gray-300 text-gray-600"
                  }`}
                >
                  5
                </span>
                <div>
                  <p className="font-medium">答案のアップロード</p>
                  <p className="text-muted-foreground text-sm">
                    スキャンした生徒の答案画像をアップロードします
                    {answerSheetCount > 0 && ` (${answerSheetCount}件アップロード済み)`}
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-sm font-medium ${
                    answerSheetCount > 0 && questionRegionCount > 0
                      ? "bg-red-100 text-red-600"
                      : "bg-gray-300 text-gray-600"
                  }`}
                >
                  6
                </span>
                <div>
                  <p className="font-medium">採点実行</p>
                  <p className="text-muted-foreground text-sm">
                    準備が完了したら採点を開始できます
                    {answerSheetCount > 0 && questionRegionCount > 0 && " (実行可能)"}
                  </p>
                </div>
              </li>
            </ol>
          </CardContent>
        </Card>

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
