"use client"

import ProtectedRoute from "@/components/auth/ProtectedRoute"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { AnswerSheetUpload } from "@/components/projects/06-answer-sheets/answer-sheet-management"
import { ConfirmChangesModal } from "@/components/projects/06-answer-sheets/answer-sheet-table/components/confirm-changes-modal"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  PendingChange,
  ScoringDataOption,
} from "@/types/answer-sheet.types"
import type { AnswerSheetWithDetails } from "@/types/electron"
import { Eye, FileEdit, Grid3X3 } from "lucide-react"
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
  customOrder?: number | null
}

export default function AnswerSheetsPage() {
  const params = useParams()
  const router = useRouter()
  const { helpButton } = usePageHelp()
  const projectId = params.projectId as string

  const [project, setProject] = useState<ProjectData | null>(null)
  const [students, setStudents] = useState<StudentData[]>([])
  const [answerSheets, setAnswerSheets] = useState<AnswerSheetWithDetails[]>([])
  const [masterImageCount, setMasterImageCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<string>("new-grid")

  // 変更状態管理
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([])
  const [affectedCells, setAffectedCells] = useState<Set<string>>(new Set())
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)

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
        // 受験生徒順序（customOrder）でソート（全生徒を含む）
        const sortedStudents = projectStudentsResult.students
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
        const masterImages =
          await window.electronAPI.getMasterImagesByProjectId(projectId)
        const maxPages =
          masterImages && masterImages.length > 0
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
    // アップロード完了時は確認タブに切り替える（オプション）
    // setActiveTab("current")
  }

  // 配置済み答案確認タブでのデータ更新用（自動更新は停止）
  const handleAnswerSheetUpdate = useCallback(() => {
    // 自動更新は行わず、通知のみ
    toast.info("変更が保存されました", {
      description: "「変更を反映」ボタンで最新データを確認してください",
    })
  }, [])

  // 変更追加ハンドラー
  const handleAddPendingChange = useCallback((change: PendingChange) => {
    setPendingChanges((prev) => [...prev, change])
    setAffectedCells(
      (prev) =>
        new Set([...prev, change.answerSheetId1, change.answerSheetId2]),
    )
    toast.success("変更を保留しました", {
      description: "「変更を反映」ボタンで確定してください",
    })
  }, [])

  // 変更適用ハンドラー
  const handleApplyChanges = useCallback(
    async (option: ScoringDataOption) => {
      if (option === "cancel") {
        setPendingChanges([])
        setAffectedCells(new Set())
        toast.info("変更をキャンセルしました")
        return
      }

      try {
        // バッチ処理でAPIコール
        for (const change of pendingChanges) {
          if (option === "with-scoring") {
            // 採点情報込みの入れ替え
            await window.electronAPI.swapAnswerSheetPlacementsWithScoring(
              change.answerSheetId1,
              change.answerSheetId2,
            )
          } else {
            // 答案画像のみの入れ替え
            await window.electronAPI.swapAnswerSheetPlacements(
              change.answerSheetId1,
              change.answerSheetId2,
            )
          }
        }

        // 成功後の処理
        setPendingChanges([])
        setAffectedCells(new Set())
        await loadData()

        const optionText =
          option === "with-scoring" ? "採点情報込み" : "答案画像のみ"
        toast.success(
          `${pendingChanges.length}件の変更を適用しました（${optionText}）`,
        )
      } catch (error) {
        console.error("変更の適用に失敗しました:", error)
        toast.error("変更の適用に失敗しました")
        throw error
      }
    },
    [pendingChanges, loadData],
  )

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
          <div className="flex gap-2">
            {pendingChanges.length > 0 && (
              <Button
                variant="default"
                onClick={() => setIsConfirmModalOpen(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <FileEdit className="h-4 w-4" />
                {pendingChanges.length}件の変更を反映
              </Button>
            )}
            <Button
              onClick={() =>
                router.push(`/projects/${projectId}/07-score-at-once`)
              }
            >
              次へ: 採点開始
            </Button>
          </div>
        </PageHeader>

        <div className="min-h-0 flex-1 overflow-hidden p-3">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex h-full flex-col"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="new-grid" className="flex items-center gap-2">
                <Grid3X3 className="h-4 w-4" />
                新規追加
              </TabsTrigger>
              <TabsTrigger value="current" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                配置済み答案の確認
              </TabsTrigger>
            </TabsList>

            <TabsContent value="new-grid" className="mt-3 min-h-0 flex-1 p-3">
              <AnswerSheetUpload
                projectId={projectId}
                students={students}
                masterImageCount={masterImageCount}
                onUploadComplete={handleUploadComplete}
              />
            </TabsContent>

            <TabsContent value="current" className="mt-3 min-h-0 flex-1 p-3">
              <AnswerSheetUpload
                projectId={projectId}
                students={students}
                masterImageCount={masterImageCount}
                onUploadComplete={handleAnswerSheetUpdate}
                existingAnswerSheets={answerSheets}
                mode="view"
                pendingChanges={pendingChanges}
                affectedCells={affectedCells}
                onAddPendingChange={handleAddPendingChange}
              />
            </TabsContent>
          </Tabs>

          {/* 変更確認モーダル */}
          <ConfirmChangesModal
            isOpen={isConfirmModalOpen}
            onClose={() => setIsConfirmModalOpen(false)}
            pendingChanges={pendingChanges}
            onConfirm={handleApplyChanges}
          />
        </div>
      </div>
    </ProtectedRoute>
  )
}
