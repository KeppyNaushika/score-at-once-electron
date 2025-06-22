"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { toast } from "sonner"
import { Upload, Eye, Trash2, UserX, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import AnswerSheetUpload from "@/components/answer-sheet/AnswerSheetUpload"
import ProtectedRoute from "@/components/auth/ProtectedRoute"
import type { AnswerSheetWithDetails } from "@/types/electron"

interface ProjectData {
  id: string
  name: string
  description?: string
}

interface StudentData {
  id: string
  name: string
  studentNumber: string
}

export default function AnswerSheetsPage() {
  const params = useParams()
  const { user } = useAuth()
  const projectId = params.projectId as string

  const [project, setProject] = useState<ProjectData | null>(null)
  const [students, setStudents] = useState<StudentData[]>([])
  const [answerSheets, setAnswerSheets] = useState<AnswerSheetWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadData = async () => {
    if (!projectId) return

    try {
      setIsLoading(true)

      // プロジェクト情報を取得
      const projectResult = await window.electronAPI.fetchProjectById(projectId)
      if (projectResult) {
        setProject({
          id: projectResult.id,
          name: projectResult.examName,
          description: projectResult.description || undefined,
        })
      }

      // 生徒情報を取得
      const studentsResult = await window.electronAPI.fetchStudents()
      setStudents(
        studentsResult.map((student: any) => ({
          id: student.id,
          name: student.name,
          studentNumber: student.studentId,
        })),
      )

      // 答案情報を取得
      const answerSheetsResult =
        await window.electronAPI.getAnswerSheetsByProjectId(projectId)
      if (answerSheetsResult.success && answerSheetsResult.answerSheets) {
        setAnswerSheets(answerSheetsResult.answerSheets)
      }
    } catch (error) {
      console.error("Error loading data:", error)
      toast.error("データの読み込みに失敗しました")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [projectId])

  const handleUploadComplete = () => {
    loadData() // データを再読み込み
  }

  const handleDeleteAnswerSheet = async (answerSheetId: string) => {
    if (!confirm("この答案を削除しますか？")) return

    try {
      const result = await window.electronAPI.deleteAnswerSheet(answerSheetId)
      if (result.success) {
        toast.success("答案を削除しました")
        loadData()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error deleting answer sheet:", error)
      toast.error("答案の削除に失敗しました")
    }
  }

  const handleSetAbsent = async (answerSheetId: string, isAbsent: boolean) => {
    try {
      const result = await window.electronAPI.setAnswerSheetAbsent(
        answerSheetId,
        isAbsent,
      )
      if (result.success) {
        toast.success(
          isAbsent ? "欠席としてマークしました" : "欠席マークを解除しました",
        )
        loadData()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error setting absent status:", error)
      toast.error("欠席状態の設定に失敗しました")
    }
  }

  const getAnswerSheetsByStatus = () => {
    const withStudent = answerSheets.filter((sheet) => sheet.student)
    const withoutStudent = answerSheets.filter((sheet) => !sheet.student)
    const absent = answerSheets.filter((sheet) => sheet.isAbsent)

    return { withStudent, withoutStudent, absent }
  }

  const { withStudent, withoutStudent, absent } = getAnswerSheetsByStatus()

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

  return (
    <ProtectedRoute>
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">
            {project?.name || "プロジェクト"} - 答案管理
          </h1>
          <p className="text-muted-foreground mt-2">
            答案画像のアップロードと管理を行います
          </p>
        </div>

        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList>
            <TabsTrigger value="upload">
              <Upload className="mr-2 h-4 w-4" />
              アップロード
            </TabsTrigger>
            <TabsTrigger value="manage">
              <Eye className="mr-2 h-4 w-4" />
              管理 ({answerSheets.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
            <AnswerSheetUpload
              projectId={projectId}
              students={students}
              onUploadComplete={handleUploadComplete}
            />
          </TabsContent>

          <TabsContent value="manage" className="space-y-6">
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">生徒と関連付け済み</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{withStudent.length}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">未関連付け</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {withoutStudent.length}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">欠席</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {absent.length}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>答案一覧</CardTitle>
                <CardDescription>
                  アップロードされた答案の管理を行います
                </CardDescription>
              </CardHeader>
              <CardContent>
                {answerSheets.length === 0 ? (
                  <div className="text-muted-foreground py-8 text-center">
                    まだ答案がアップロードされていません
                  </div>
                ) : (
                  <div className="space-y-4">
                    {answerSheets.map((sheet) => (
                      <div
                        key={sheet.id}
                        className="flex items-center gap-4 rounded-lg border p-4"
                      >
                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="font-medium">
                              {sheet.student
                                ? `${sheet.student.lastName} ${sheet.student.firstName}`
                                : "未関連付け"}
                            </span>
                            {sheet.student && (
                              <Badge variant="secondary">
                                {sheet.student.studentId}
                              </Badge>
                            )}
                            <Badge variant="outline">
                              ページ {sheet.pageNumber}
                            </Badge>
                            {sheet.isAbsent && (
                              <Badge variant="destructive">欠席</Badge>
                            )}
                          </div>
                          <p className="text-muted-foreground text-sm">
                            アップロード:{" "}
                            {new Date(sheet.createdAt).toLocaleString()}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {!sheet.isAbsent ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetAbsent(sheet.id, true)}
                            >
                              <UserX className="mr-1 h-4 w-4" />
                              欠席
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetAbsent(sheet.id, false)}
                            >
                              <User className="mr-1 h-4 w-4" />
                              出席
                            </Button>
                          )}

                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteAnswerSheet(sheet.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ProtectedRoute>
  )
}
