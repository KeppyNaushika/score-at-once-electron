"use client"

import AnswerSheetUploadNew from "@/components/answer-sheet/AnswerSheetUpload"
import ProtectedRoute from "@/components/auth/ProtectedRoute"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/contexts/AuthContext"
import type { AnswerSheetWithDetails } from "@/types/electron"
import { Eye, Trash2, Upload, User, UserX, Grid3X3, FileImage } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

interface ProjectData {
  id: string
  name: string
  description?: string
}

interface StudentData {
  id: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  studentId: string
  attendanceNumber?: number | null
  status?: "participating" | "expected" | "absent"
  customOrder?: number | null  // 🚨 必須: 受験生徒順序
}

export default function AnswerSheetsPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const { helpButton } = usePageHelp()
  const projectId = params.projectId as string

  const [project, setProject] = useState<ProjectData | null>(null)
  const [students, setStudents] = useState<StudentData[]>([])
  const [answerSheets, setAnswerSheets] = useState<AnswerSheetWithDetails[]>([])
  const [masterImageCount, setMasterImageCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)

  const loadData = useCallback(async () => {
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

      // プロジェクトの受験生徒情報を取得
      const projectStudentsResult =
        await window.electronAPI.getStudentsForProject(projectId)
      if (projectStudentsResult.success && projectStudentsResult.students) {
        // 受験生徒順序（customOrder）でソート
        const sortedStudents = projectStudentsResult.students
          .filter((s: any) => s.status === "participating") // 受験する生徒のみ
          .sort((a: any, b: any) => {
            // customOrderが設定されている場合はそれを優先
            if (
              a.customOrder !== null &&
              a.customOrder !== undefined &&
              b.customOrder !== null &&
              b.customOrder !== undefined
            ) {
              return a.customOrder - b.customOrder
            }
            if (a.customOrder !== null && a.customOrder !== undefined) return -1
            if (b.customOrder !== null && b.customOrder !== undefined) return 1

            // customOrderが未設定の場合は出席番号順をフォールバック
            const aNumber = a.memberships?.[0]?.attendanceNumber
            const bNumber = b.memberships?.[0]?.attendanceNumber

            if (aNumber && bNumber) {
              return aNumber - bNumber
            }
            if (aNumber) return -1
            if (bNumber) return 1

            // 出席番号もない場合は名前順
            const aName = `${a.lastName}${a.firstName}`
            const bName = `${b.lastName}${b.firstName}`
            return aName.localeCompare(bName)
          })
          .map((student: any) => ({
            id: student.id,
            lastName: student.lastName,
            firstName: student.firstName,
            lastNameKana: student.lastNameKana,
            firstNameKana: student.firstNameKana,
            studentId: student.studentId,
            attendanceNumber:
              student.memberships?.[0]?.attendanceNumber || null,
            status: student.status,
            customOrder: student.customOrder ?? null,
          }))

        setStudents(sortedStudents)
      }

      // 答案情報を取得
      const answerSheetsResult =
        await window.electronAPI.getAnswerSheetsByProjectId(projectId)
      if (answerSheetsResult.success && answerSheetsResult.answerSheets) {
        setAnswerSheets(answerSheetsResult.answerSheets)
      }

      // 模範解答のページ数を取得
      try {
        const masterImages = await window.electronAPI.getMasterImagesByProjectId(projectId)
        const maxPages = masterImages && masterImages.length > 0
          ? Math.max(...masterImages.map((img: any) => img.pageNumber))
          : 0
        setMasterImageCount(maxPages)
      } catch (error) {
        console.error("Failed to load master image count:", error)
        setMasterImageCount(0)
      }
    } catch (error) {
      console.error("Error loading data:", error)
      toast.error("データの読み込みに失敗しました")
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadData()
  }, [projectId, loadData])

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
      <div className="flex h-full flex-col overflow-y-auto">
        <PageHeader
          title="生徒解答のアップロード"
          description=""
          helpButton={helpButton}
        >
          <Button
            onClick={() =>
              router.push(`/projects/${projectId}/06-score-at-once`)
            }
          >
            次へ: 採点開始
          </Button>
        </PageHeader>

        <div className="min-h-0 flex-1 overflow-hidden p-3">
          <Tabs defaultValue="new-grid" className="flex h-full flex-col">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="new-grid" className="flex items-center gap-2">
                <Grid3X3 className="h-4 w-4" />
                新規追加
              </TabsTrigger>
              <TabsTrigger value="current" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                現在の対応状況
              </TabsTrigger>
            </TabsList>

            <TabsContent value="new-grid" className="mt-3 min-h-0 flex-1 p-3">
              <AnswerSheetUploadNew
                projectId={projectId}
                students={students}
                masterImageCount={masterImageCount}
                onUploadComplete={handleUploadComplete}
              />
            </TabsContent>

            <TabsContent
              value="current"
              className="mt-3 flex min-h-0 flex-1 flex-col gap-3 p-3"
            >
              {/* 対応状況 */}
              <div className="grid grid-cols-3 gap-2">
                <Card className="border-l-4 border-l-green-500">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs">関連付け済み</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-lg font-bold">
                      {withStudent.length}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-orange-500">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs">未関連付け</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-lg font-bold text-orange-600">
                      {withoutStudent.length}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-red-500">
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs">欠席</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-lg font-bold text-red-600">
                      {absent.length}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* 生徒と答案の対応表 */}
              <div className="min-h-0 flex-1 rounded-lg border">
                <div className="h-full overflow-auto">
                  {answerSheets.length === 0 ? (
                    <div className="text-muted-foreground py-8 text-center text-sm">
                      まだ答案がアップロードされていません
                    </div>
                  ) : (
                    <Table>
                      <TableHeader className="bg-background sticky top-0 z-10">
                        <TableRow>
                          <TableHead className="w-[120px]">プレビュー</TableHead>
                          <TableHead>生徒情報</TableHead>
                          <TableHead className="w-[100px]">ページ</TableHead>
                          <TableHead className="w-[80px]">状態</TableHead>
                          <TableHead className="w-[150px]">アップロード日時</TableHead>
                          <TableHead className="w-[100px]">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {answerSheets.map((sheet) => (
                          <TableRow key={sheet.id}>
                            <TableCell>
                              <div className="h-16 w-24 rounded border bg-gray-50 overflow-hidden">
                                {sheet.originalImagePath ? (
                                  <img
                                    src={sheet.originalImagePath}
                                    alt={`ページ ${sheet.pageNumber}`}
                                    className="h-full w-full object-contain"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center">
                                    <FileImage className="h-6 w-6 text-gray-400" />
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="font-medium text-sm">
                                  {sheet.student
                                    ? `${sheet.student.lastName} ${sheet.student.firstName}`
                                    : "未関連付け"}
                                </div>
                                {sheet.student && (
                                  <Badge variant="secondary" className="text-xs">
                                    {sheet.student.studentId}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="text-xs">
                                {sheet.pageNumber}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {sheet.isAbsent ? (
                                <Badge variant="destructive" className="text-xs">
                                  欠席
                                </Badge>
                              ) : (
                                <Badge variant="default" className="text-xs">
                                  有効
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(sheet.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {!sheet.isAbsent ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => handleSetAbsent(sheet.id, true)}
                                  >
                                    <UserX className="h-3 w-3" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={() => handleSetAbsent(sheet.id, false)}
                                  >
                                    <User className="h-3 w-3" />
                                  </Button>
                                )}

                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handleDeleteAnswerSheet(sheet.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ProtectedRoute>
  )
}
