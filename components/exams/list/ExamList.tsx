"use client"

import {
  ArrowDownAZ,
  ArrowUpAZ,
  Calculator,
  CalendarArrowDown,
  CalendarArrowUp,
  Check,
  Download,
  Edit,
  Eye,
  FileImage,
  FolderInput,
  FolderOutput,
  PlayCircle,
  PlusCircle,
  Settings,
  SortDesc,
  Upload,
  Users,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

import ExportModeModal from "@/components/exams/detail/ExportModeModal"
import CreateExamWindow from "@/components/exams/forms/CreateExamWindow"
import { useExams } from "@/components/hooks/useExams"
import { useFileActions } from "@/components/hooks/useFileActions"
import { ImportWizardModal } from "@/components/import/ImportWizardModal"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { useAuth } from "@/contexts/AuthContext"
import { SortDirection, useTableSort } from "@/hooks/useTableSort"
import type { ExamListItem } from "@/types/common.types"
import type { ExportMode } from "@/types/examArchive.types"

interface ExamSortable {
  id: string
  examName: string
  examDate: string | null
  original: ExamListItem
}

const SORT_OPTIONS = [
  {
    key: "examDate",
    direction: "desc",
    label: "実施日（新しい順）",
    icon: CalendarArrowDown,
  },
  {
    key: "examDate",
    direction: "asc",
    label: "実施日（古い順）",
    icon: CalendarArrowUp,
  },
  {
    key: "examName",
    direction: "asc",
    label: "試験名（A→Z）",
    icon: ArrowDownAZ,
  },
  {
    key: "examName",
    direction: "desc",
    label: "試験名（Z→A）",
    icon: ArrowUpAZ,
  },
] as const

const File = () => {
  const { exams, loadExams } = useExams()
  const { user } = useAuth()
  const [showImportModal, setShowImportModal] = useState(false)
  const [selectedExamIds, setSelectedExamIds] = useState<Set<string>>(new Set())
  const [isBulkExporting, setIsBulkExporting] = useState(false)
  const [showBulkExportModal, setShowBulkExportModal] = useState(false)

  const { createExamModal } = useFileActions()
  const router = useRouter()

  // ソート用データに変換
  const sortableData = useMemo<ExamSortable[]>(() => {
    return exams.map((exam) => ({
      id: exam.id,
      examName: exam.examName,
      examDate: exam.examDate ? new Date(exam.examDate).toISOString() : null,
      original: exam,
    }))
  }, [exams])

  // ソート機能（localStorage永続化、既定: 実施日降順）
  const { sortedData, sortConfig, setSort } = useTableSort(sortableData, {
    defaultSort: { key: "examDate", direction: "desc" },
    storageKey: "examList-sort",
  })

  // 現在のソート設定に一致するオプションを取得
  const currentSortLabel = useMemo(() => {
    const option = SORT_OPTIONS.find(
      (opt) =>
        opt.key === sortConfig.key && opt.direction === sortConfig.direction
    )
    return option?.label || "並び替え"
  }, [sortConfig])

  const handleSortSelect = (
    key: keyof ExamSortable,
    direction: SortDirection
  ) => {
    if (direction) {
      setSort(key, direction)
    }
  }

  const handleStartScoring = (exam: ExamListItem) => {
    router.push(`/exams/${exam.id}`)
  }

  const handleNextStep = (exam: ExamListItem) => {
    router.push(exam.status.url)
  }

  const handleImportComplete = (examId: string) => {
    loadExams()
    router.push(`/exams/${examId}`)
  }

  const handleToggleSelect = useCallback((examId: string) => {
    setSelectedExamIds((prev) => {
      const next = new Set(prev)
      if (next.has(examId)) {
        next.delete(examId)
      } else {
        next.add(examId)
      }
      return next
    })
  }, [])

  const handleToggleSelectAll = useCallback(() => {
    setSelectedExamIds((prev) => {
      if (prev.size === sortedData.length) {
        return new Set()
      }
      return new Set(sortedData.map((d) => d.id))
    })
  }, [sortedData])

  const handleBulkExport = useCallback(
    async (exportMode: ExportMode) => {
      if (!user || selectedExamIds.size === 0) return

      setIsBulkExporting(true)
      toast("書き出し中...", {
        description: `${selectedExamIds.size}件の試験を書き出しています。`,
      })

      try {
        const result = await window.electronAPI.archive.bulkExportExams({
          examIds: Array.from(selectedExamIds),
          userId: user.id,
          exportMode,
        })

        if (result.error === "canceled") {
          // フォルダ選択キャンセル時はtoast表示なし
          return
        }

        const successCount = result.results.filter((r) => r.success).length
        const failCount = result.results.filter((r) => !r.success).length

        if (failCount === 0) {
          toast.success("書き出し完了", {
            description: `${successCount}件の試験を書き出しました。`,
          })
        } else {
          toast.warning("一部書き出しに失敗", {
            description: `${successCount}件成功、${failCount}件失敗`,
          })
        }

        setSelectedExamIds(new Set())
        setShowBulkExportModal(false)
      } catch (error) {
        toast.error("書き出しに失敗しました", {
          description:
            error instanceof Error
              ? error.message
              : "予期しないエラーが発生しました",
        })
      } finally {
        setIsBulkExporting(false)
      }
    },
    [user, selectedExamIds]
  )

  return (
    <>
      {createExamModal.isOpen && (
        <CreateExamWindow
          onClose={createExamModal.close}
          onExamCreated={loadExams}
        />
      )}
      <ImportWizardModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onComplete={handleImportComplete}
      />
      <ExportModeModal
        open={showBulkExportModal}
        onOpenChange={setShowBulkExportModal}
        onExport={handleBulkExport}
        isExporting={isBulkExporting}
      />
      <div className="flex h-full min-w-full flex-col">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center space-x-2">
            <Button
              onClick={createExamModal.open}
              variant="outline"
              className="rounded-lg"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              新規試験作成
            </Button>
            <Button
              onClick={() => setShowImportModal(true)}
              variant="outline"
              className="rounded-lg"
            >
              <FolderInput className="mr-2 h-4 w-4" />
              インポート
            </Button>
            {selectedExamIds.size > 0 && (
              <>
                <span className="text-muted-foreground ml-2 text-sm">
                  {selectedExamIds.size}件選択中
                </span>
                <Button
                  onClick={() => setShowBulkExportModal(true)}
                  variant="outline"
                  className="rounded-lg"
                  disabled={isBulkExporting}
                >
                  <FolderOutput className="mr-2 h-4 w-4" />
                  一括書き出し
                </Button>
              </>
            )}
          </div>

          {/* ソート選択 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 rounded-lg">
                <SortDesc className="h-4 w-4" />
                {currentSortLabel}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>並び替え</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SORT_OPTIONS.map((option) => {
                const Icon = option.icon
                const isSelected =
                  sortConfig.key === option.key &&
                  sortConfig.direction === option.direction
                return (
                  <DropdownMenuItem
                    key={`${option.key}-${option.direction}`}
                    onClick={() =>
                      handleSortSelect(option.key, option.direction)
                    }
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {option.label}
                    {isSelected && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* テーブルエリア */}
        <div className="min-h-0 flex-1 p-4">
          <div className="border-border/50 h-full overflow-hidden rounded-xl border shadow-sm">
            <Table wrapperClassName="h-full">
              <TableHeader className="bg-card sticky top-0 z-10">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 text-center">
                    <Checkbox
                      checked={
                        sortedData.length > 0 &&
                        selectedExamIds.size === sortedData.length
                      }
                      onCheckedChange={handleToggleSelectAll}
                      aria-label="全選択"
                    />
                  </TableHead>
                  <TableHead>試験名</TableHead>
                  <TableHead className="w-32 text-center">詳細</TableHead>
                  <TableHead className="w-40 text-center">
                    次のステップ
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map(({ original: exam }) => {
                  return (
                    <TableRow key={exam.id} className="group">
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedExamIds.has(exam.id)}
                          onCheckedChange={() => handleToggleSelect(exam.id)}
                          aria-label={`${exam.examName}を選択`}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{exam.examName}</div>
                          <div className="text-muted-foreground text-sm tabular-nums">
                            {exam.examDate
                              ? new Date(exam.examDate).toLocaleDateString(
                                  "ja-JP"
                                )
                              : "実施日未設定"}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg"
                          onClick={() => handleStartScoring(exam)}
                        >
                          <Eye className="mr-1 h-4 w-4" />
                          詳細
                        </Button>
                      </TableCell>

                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          onClick={() => handleNextStep(exam)}
                          className="w-48 justify-start rounded-lg text-left"
                        >
                          {exam.status.step === 1 && (
                            <FileImage className="mr-1 h-4 w-4" />
                          )}
                          {exam.status.step === 2 && (
                            <Settings className="mr-1 h-4 w-4" />
                          )}
                          {exam.status.step === 3 && (
                            <Edit className="mr-1 h-4 w-4" />
                          )}
                          {exam.status.step === 4 && (
                            <Calculator className="mr-1 h-4 w-4" />
                          )}
                          {exam.status.step === 5 && (
                            <Users className="mr-1 h-4 w-4" />
                          )}
                          {exam.status.step === 6 && (
                            <Upload className="mr-1 h-4 w-4" />
                          )}
                          {exam.status.step === 7 && (
                            <PlayCircle className="mr-1 h-4 w-4" />
                          )}
                          {exam.status.step === 8 && (
                            <Download className="mr-1 h-4 w-4" />
                          )}
                          <span className="text-xs">{exam.status.text}</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </>
  )
}

export default File
