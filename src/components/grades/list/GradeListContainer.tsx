"use client"

import {
  BarChart3,
  ClipboardEdit,
  Download,
  Eye,
  FolderInput,
  MoreHorizontal,
  Plus,
  Settings,
  Sliders,
  Trash2,
  Users,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getGradeStatus } from "@/lib/gradeStatus"
import type { GradeWithDetails } from "@/types/grade.types"

import { GradeCreateDialog } from "./GradeCreateDialog"

const STEP_ICONS: Record<
  number,
  React.ComponentType<{ className?: string }>
> = {
  2: Users,
  3: Settings,
  4: ClipboardEdit,
  5: Sliders,
  6: BarChart3,
}

/**
 * 成績算出試験の一覧コンテナ
 *
 * テーブル形式で試験一覧を表示し、次のステップへのナビゲーションを提供する。
 */
export function GradeListContainer() {
  const router = useRouter()
  const [grades, setGrades] = useState<GradeWithDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const loadGrades = useCallback(async () => {
    try {
      const result = await window.electronAPI.grade.getAll()
      if (result.success && result.grades) {
        setGrades(result.grades)
      }
    } catch (error) {
      console.error("Error loading grade exams:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadGrades()
  }, [loadGrades])

  const handleCreated = (id: string) => {
    setShowCreateDialog(false)
    router.push(`/grades/${id}/01-setup`)
  }

  const handleDelete = async (id: string) => {
    try {
      const result = await window.electronAPI.grade.delete(id)
      if (result.success) {
        setGrades((prev) => prev.filter((grade) => grade.id !== id))
      }
    } catch (error) {
      console.error("Error deleting grade exam:", error)
    }
  }

  const handleImport = async () => {
    const result = await window.electronAPI.grade.importArchive()
    if (result.success && result.archiveData) {
      const importResult = await window.electronAPI.grade.executeImport(
        result.archiveData
      )
      if (importResult.success && importResult.gradeId) {
        router.push(`/grades/${importResult.gradeId}/01-setup`)
      }
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-w-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setShowCreateDialog(true)}
            variant="outline"
            className="rounded-lg"
          >
            <Plus className="mr-2 h-4 w-4" />
            新規作成
          </Button>
          <Button
            onClick={handleImport}
            variant="outline"
            className="rounded-lg"
          >
            <FolderInput className="mr-2 h-4 w-4" />
            インポート
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 p-4">
        {grades.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed">
            <p className="text-muted-foreground mb-2">
              成績算出試験がありません
            </p>
            <Button variant="outline" onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              最初の試験を作成
            </Button>
          </div>
        ) : (
          <div className="border-border/50 h-full overflow-hidden rounded-xl border shadow-sm">
            <Table wrapperClassName="h-full">
              <TableHeader className="bg-card sticky top-0 z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead>試験名</TableHead>
                  <TableHead className="w-32 text-center">詳細</TableHead>
                  <TableHead className="w-52 text-center">
                    次のステップ
                  </TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grades.map((grade) => {
                  const status = getGradeStatus(grade)
                  const StepIcon = STEP_ICONS[status.step] ?? BarChart3

                  const classNames = grade.gradeClasses
                    .map((gradeClass) => gradeClass.class.name)
                    .join("、")

                  return (
                    <TableRow key={grade.id} className="group">
                      <TableCell>
                        <div>
                          <div className="font-medium">{grade.name}</div>
                          <div className="text-muted-foreground text-sm">
                            {classNames || "学級未登録"}
                            {" / "}
                            生徒: {grade._count?.gradeStudents ?? 0}名 /
                            評価項目:{" "}
                            {grade._count?.gradeItems ??
                              grade.gradeItems.length}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg"
                          onClick={() => router.push(`/grades/${grade.id}`)}
                        >
                          <Eye className="mr-1 h-4 w-4" />
                          詳細
                        </Button>
                      </TableCell>

                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          onClick={() => router.push(status.url)}
                          className="w-48 justify-start rounded-lg text-left"
                        >
                          <StepIcon className="mr-1 h-4 w-4" />
                          <span className="text-xs">{status.text}</span>
                        </Button>
                      </TableCell>

                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                window.electronAPI.grade.exportArchive(grade.id)
                              }
                            >
                              <Download className="mr-2 h-4 w-4" />
                              エクスポート
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDelete(grade.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              削除
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <GradeCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={handleCreated}
      />
    </div>
  )
}
