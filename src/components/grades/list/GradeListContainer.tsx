"use client"

import {
  BarChart3,
  ClipboardEdit,
  Copy,
  Eye,
  FolderInput,
  FolderOutput,
  MoreHorizontal,
  Plus,
  Settings,
  Sliders,
  Trash2,
  Users,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { ListFilterBar } from "@/components/common/ListFilterBar"
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
import { type ListFilterAccessors, useListFilter } from "@/hooks/useListFilter"
import { collectClassroomOptions } from "@/lib/filterOptions"
import { getGradeStatus } from "@/lib/gradeStatus"
import type { CourseworkImportDecision } from "@/types/courseworkArchive.types"
import type { GradeSummary } from "@/types/grade.types"
import type {
  GradeArchiveData,
  GradeArchiveImportPreview,
} from "@/types/gradeArchive.types"

import { GradeCreateDialog } from "./GradeCreateDialog"
import { GradeImportDialog } from "./GradeImportDialog"

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

/** 成績算出一覧のフィルタ対象値（名前・説明・学級名／学級／基準日） */
const GRADE_FILTER_ACCESSORS: ListFilterAccessors<GradeSummary> = {
  searchTexts: (grade) => [
    grade.name,
    grade.description,
    ...grade.gradeClassrooms.map(
      (gradeClassroom) => gradeClassroom.classroom.name
    ),
  ],
  classroomIds: (grade) =>
    grade.gradeClassrooms.map((gradeClassroom) => gradeClassroom.classroomId),
  date: (grade) => grade.referenceDate,
}

/**
 * 成績算出試験の一覧コンテナ
 *
 * テーブル形式で試験一覧を表示し、次のステップへのナビゲーションを提供する。
 */
export function GradeListContainer() {
  const router = useRouter()
  const [grades, setGrades] = useState<GradeSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  // インポート確認ウィザードの状態
  const [importPreview, setImportPreview] =
    useState<GradeArchiveImportPreview | null>(null)
  const [importArchiveData, setImportArchiveData] =
    useState<GradeArchiveData | null>(null)
  const [importing, setImporting] = useState(false)

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
    // 作成直後は基本設定（基準日など）を促すため編集モーダルを開いた状態で開く
    router.push(`/grades/${id}?setup=1`)
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

  const handleDuplicate = async (id: string) => {
    try {
      const result = await window.electronAPI.grade.duplicate(id)
      if (result.success && result.grade) {
        await loadGrades()
        toast.success(`「${result.grade.name}」を複製しました`)
      } else if (!result.success) {
        toast.error("複製に失敗しました", { description: result.error })
      }
    } catch (error) {
      console.error("Error duplicating grade exam:", error)
      toast.error("複製に失敗しました")
    }
  }

  const handleImport = async () => {
    const result = await window.electronAPI.grade.importArchive()
    if (result.success && result.archiveData && result.preview) {
      // ファイル選択後はウィザードを開き、照合方法をユーザーに判断させる
      setImportArchiveData(result.archiveData)
      setImportPreview(result.preview)
    }
  }

  const handleImportConfirm = async (
    decisions: Record<string, CourseworkImportDecision>
  ) => {
    if (!importArchiveData || !importPreview) return
    setImporting(true)
    try {
      // 試験参照のマッピング（examName → 既存examId）を照合結果から構築
      const examMapping: Record<string, string> = {}
      for (const examMatch of importPreview.examMatches) {
        if (examMatch.found && examMatch.examId)
          examMapping[examMatch.examName] = examMatch.examId
      }
      const importResult = await window.electronAPI.grade.executeImport(
        importArchiveData,
        { examMapping, courseworkDecisions: decisions }
      )
      if (importResult.success && importResult.gradeId) {
        // 取り込み警告（点数スキップ・参照先未検出など）があれば通知する。
        // 自動で消えると見落とすため手動で閉じるまで表示し、全件を本文に載せる。
        if (importResult.warnings && importResult.warnings.length > 0) {
          toast.warning(
            `インポートは完了しましたが ${importResult.warnings.length} 件の警告があります`,
            {
              description: importResult.warnings.join("\n"),
              duration: Infinity,
              closeButton: true,
            }
          )
        }
        router.push(`/grades/${importResult.gradeId}`)
      } else if (!importResult.success) {
        toast.error("インポートに失敗しました", {
          description: importResult.error,
        })
      }
    } finally {
      setImporting(false)
      setImportPreview(null)
      setImportArchiveData(null)
    }
  }

  const handleImportCancel = () => {
    setImportPreview(null)
    setImportArchiveData(null)
  }

  // 一覧に出現する学級を集約してフィルタ選択肢にする
  const classroomOptions = useMemo(
    () =>
      collectClassroomOptions(grades, (grade) =>
        grade.gradeClassrooms.map((gradeClassroom) => gradeClassroom.classroom)
      ),
    [grades]
  )

  const {
    filteredItems: filteredGrades,
    searchTerm,
    setSearchTerm,
    filterClassroomIds,
    toggleClassroomId,
    clearClassroomIds,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
  } = useListFilter(grades, GRADE_FILTER_ACCESSORS)

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
            .grade 読み込み
          </Button>
        </div>
        {grades.length > 0 && (
          <ListFilterBar
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            searchPlaceholder="試験名・学級で検索"
            totalCount={grades.length}
            filteredCount={filteredGrades.length}
            classroomFilter={{
              options: classroomOptions,
              selectedIds: filterClassroomIds,
              onToggle: toggleClassroomId,
              onClear: clearClassroomIds,
            }}
            dateRangeFilter={{
              label: "基準日",
              from: dateFrom,
              to: dateTo,
              onFromChange: setDateFrom,
              onToChange: setDateTo,
            }}
          />
        )}
      </div>

      <div className="min-h-0 flex-1 p-4">
        {grades.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-lg border-2 border-dashed">
            <p className="mb-2 text-muted-foreground">
              成績算出試験がありません
            </p>
            <Button variant="outline" onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              最初の試験を作成
            </Button>
          </div>
        ) : (
          <div className="h-full overflow-hidden rounded-xl border border-border/50 shadow-sm">
            <Table wrapperClassName="h-full">
              <TableHeader className="sticky top-0 z-10 bg-card">
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
                {filteredGrades.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-muted-foreground"
                    >
                      条件に一致する試験がありません
                    </TableCell>
                  </TableRow>
                )}
                {filteredGrades.map((grade) => {
                  const status = getGradeStatus(grade)
                  const StepIcon = STEP_ICONS[status.step] ?? BarChart3

                  const classNames = grade.gradeClassrooms
                    .map((gradeClassroom) => gradeClassroom.classroom.name)
                    .join("、")

                  return (
                    <TableRow key={grade.id} className="group">
                      <TableCell>
                        <div>
                          <div className="font-medium">{grade.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {classNames || "学級未登録"}
                            {" / "}
                            生徒: {grade.gradeStudents.length}名 / 評価項目:{" "}
                            {grade.gradeItems.length}
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
                          <StepIcon className="mr-1 h-4 w-4 shrink-0" />
                          <span className="min-w-0 truncate text-xs">
                            {status.text}
                          </span>
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
                              onClick={() => handleDuplicate(grade.id)}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              複製
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                window.electronAPI.grade.exportArchive(grade.id)
                              }
                            >
                              <FolderOutput className="mr-2 h-4 w-4" />
                              .grade 書き出し
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

      <GradeImportDialog
        open={importPreview !== null}
        preview={importPreview}
        importing={importing}
        onCancel={handleImportCancel}
        onConfirm={handleImportConfirm}
      />
    </div>
  )
}
