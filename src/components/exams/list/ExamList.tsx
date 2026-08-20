"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Calculator,
  Download,
  Edit,
  Eye,
  FileImage,
  FolderInput,
  FolderOutput,
  PlayCircle,
  PlusCircle,
  Settings,
  Upload,
  Users,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

import { BulkTagAssignButton } from "@/components/common/BulkTagAssignButton"
import type { ExportOutcome } from "@/components/common/ExportResultSummary"
import { ListFilterBar } from "@/components/common/ListFilterBar"
import ExamArchiveExportModal from "@/components/exams/detail/ExamArchiveExportModal"
import CreateExamWindow from "@/components/exams/forms/CreateExamWindow"
import { useFileActions } from "@/components/hooks/useFileActions"
import { ImportWizardModal } from "@/components/import/ImportWizardModal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { SortableTableHead } from "@/components/ui/SortableTableHead"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuth } from "@/contexts/AuthContext"
import type { TagWithAllRelations } from "@/electron-src/lib/prisma/tag"
import { type ListFilterAccessors, useListFilter } from "@/hooks/useListFilter"
import { useRowSelection } from "@/hooks/useRowSelection"
import { useTableSort } from "@/hooks/useTableSort"
import {
  type ExamSummary,
  getExamProgress,
  getExamWorkflowStatus,
} from "@/lib/examStatus"
import { bulkExportExamsMutation } from "@/queries/archive"
import { examListQuery } from "@/queries/exam"
import {
  addTagToExamsMutation,
  findOrCreateTagMutation,
  tagListQuery,
} from "@/queries/tag"
import type { ArchiveExportMode } from "@/types/examArchive.types"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_TAGS: TagWithAllRelations[] = []
const EMPTY_EXAMS: ExamSummary[] = []

interface ExamSortable {
  id: string
  examName: string
  examDate: string | null
  original: ExamSummary
}

/** 試験一覧のフィルタ対象値の取り出し（検索=試験名・説明・タグ名、タグ絞り込み=タグ id） */
const EXAM_FILTER_ACCESSORS: ListFilterAccessors<ExamSummary> = {
  searchTexts: (exam) => [
    exam.examName,
    exam.description,
    ...exam.tags.map((tag) => tag.name),
  ],
  tagIds: (exam) => exam.tags.map((tag) => tag.id),
}

const File = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { data: exams = EMPTY_EXAMS } = useQuery(examListQuery(user?.id))
  const loadExams = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: examListQuery(user?.id).queryKey,
      }),
    [queryClient, user?.id]
  )
  const { data: allTags = EMPTY_TAGS } = useQuery(tagListQuery())
  const findOrCreateTag = useMutation(findOrCreateTagMutation())
  const addTagToExams = useMutation(addTagToExamsMutation())
  const bulkExportExams = useMutation(bulkExportExamsMutation())
  const [showImportModal, setShowImportModal] = useState(false)
  const [isBulkExporting, setIsBulkExporting] = useState(false)
  const [showBulkExportModal, setShowBulkExportModal] = useState(false)
  /** 一括書き出しの結果。渡している間はモーダルが結果の段を見せる */
  const [bulkExportOutcome, setBulkExportOutcome] =
    useState<ExportOutcome | null>(null)

  const { createExamModal } = useFileActions()
  const router = useRouter()

  // 既存タグ一覧を取得
  const {
    filteredItems: filteredExams,
    searchTerm,
    setSearchTerm,
    filterTagIds,
    toggleTagId,
    clearTagIds,
  } = useListFilter(exams, EXAM_FILTER_ACCESSORS)

  // ソート用データに変換
  const sortableData = useMemo<ExamSortable[]>(() => {
    return filteredExams.map((exam) => ({
      id: exam.id,
      examName: exam.examName,
      examDate: exam.examDate ? new Date(exam.examDate).toISOString() : null,
      original: exam,
    }))
  }, [filteredExams])

  // ソート機能（localStorage永続化、既定: 実施日降順）
  const { sortedData, sortConfig, requestSort } = useTableSort(sortableData, {
    defaultSort: { key: "examDate", direction: "desc" },
    storageKey: "examList-sort",
  })

  const {
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    allSelected,
    clearSelection,
  } = useRowSelection(sortedData)

  const handleStartScoring = (exam: ExamSummary) => {
    router.push(`/exams/${exam.id}`)
  }

  const handleNextStep = (url: string) => {
    router.push(url)
  }

  const handleImportComplete = (examId: string) => {
    loadExams()
    router.push(`/exams/${examId}`)
  }

  const handleBulkAddTag = useCallback(
    async (tagName: string) => {
      if (!tagName.trim() || selectedIds.size === 0) return
      const tag = await findOrCreateTag.mutateAsync(tagName.trim())
      await addTagToExams.mutateAsync({
        examIds: [...selectedIds],
        tagId: tag.id,
      })
      toast.success("タグを追加しました", {
        description: `${selectedIds.size}件の試験に「${tagName.trim()}」を追加`,
      })
      clearSelection()
    },
    [selectedIds, clearSelection, findOrCreateTag, addTagToExams]
  )

  const handleBulkExport = useCallback(
    async (exportMode: ArchiveExportMode) => {
      if (!user || selectedIds.size === 0) return

      setIsBulkExporting(true)
      toast("書き出し中...", {
        description: `${selectedIds.size}件の試験を書き出しています。`,
      })

      try {
        const bulkResult = await bulkExportExams.mutateAsync({
          examIds: Array.from(selectedIds),
          userId: user.id,
          exportMode,
        })

        if (bulkResult.canceled) {
          // 出力先を選ばずに閉じたのは失敗ではないので、何も言わない
          return
        }

        // 結果はモーダルの中で見せる。**欠けたファイルも試験ごとの失敗も落とさない**。
        // 書き出し中に閉じられていても、結果は見せる
        setShowBulkExportModal(true)
        setBulkExportOutcome({
          archives: bulkResult.results.flatMap((exportResult) =>
            exportResult.success && exportResult.outputPath
              ? [
                  {
                    sourceId: exportResult.examId,
                    sourceName: exportResult.examName,
                    outputPath: exportResult.outputPath,
                    missingFiles: exportResult.missingFiles,
                  },
                ]
              : []
          ),
          failures: bulkResult.results.flatMap((exportResult) =>
            exportResult.success
              ? []
              : [
                  {
                    sourceId: exportResult.examId,
                    sourceName: exportResult.examName,
                    error: exportResult.error ?? "書き出しに失敗しました",
                  },
                ]
          ),
        })

        clearSelection()
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
    [user, selectedIds, clearSelection, bulkExportExams]
  )

  /** 閉じたら結果を捨てる（次に開いたときは選択の段から始まる） */
  const handleBulkExportModalOpenChange = useCallback((open: boolean) => {
    setShowBulkExportModal(open)
    if (!open) {
      setBulkExportOutcome(null)
    }
  }, [])

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
      <ExamArchiveExportModal
        open={showBulkExportModal}
        onOpenChange={handleBulkExportModalOpenChange}
        onExport={handleBulkExport}
        isExporting={isBulkExporting}
        exportOutcome={bulkExportOutcome}
      />
      <div className="flex h-full min-w-full flex-col">
        <div className="border-b px-4 py-3">
          <ListFilterBar
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            searchPlaceholder="試験名・タグで検索"
            totalCount={exams.length}
            filteredCount={filteredExams.length}
            tagFilter={{
              options: allTags,
              selectedIds: filterTagIds,
              onToggle: toggleTagId,
              onClear: clearTagIds,
            }}
            leading={
              <>
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
                  .score 読み込み
                </Button>
                {selectedIds.size > 0 && (
                  <>
                    <span className="text-sm text-muted-foreground">
                      {selectedIds.size}件選択中
                    </span>
                    <BulkTagAssignButton
                      selectedCount={selectedIds.size}
                      allTags={allTags}
                      onAssign={handleBulkAddTag}
                    />
                    <Button
                      onClick={() => setShowBulkExportModal(true)}
                      variant="outline"
                      className="rounded-lg"
                      disabled={isBulkExporting}
                    >
                      <FolderOutput className="mr-2 h-4 w-4" />
                      .score 一括書き出し
                    </Button>
                  </>
                )}
              </>
            }
          />
        </div>

        {/* テーブルエリア */}
        <div className="min-h-0 flex-1 p-4">
          <div className="h-full overflow-hidden rounded-xl border border-border/50 shadow-sm">
            <Table wrapperClassName="h-full">
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 text-center">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(checked) =>
                        toggleSelectAll(checked === true)
                      }
                      aria-label="全選択"
                    />
                  </TableHead>
                  <SortableTableHead
                    sortKey="examName"
                    currentSortKey={sortConfig.key}
                    currentDirection={sortConfig.direction}
                    onSort={requestSort}
                  >
                    試験名
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="examDate"
                    currentSortKey={sortConfig.key}
                    currentDirection={sortConfig.direction}
                    onSort={requestSort}
                    className="w-28 text-center"
                  >
                    試験日
                  </SortableTableHead>
                  <TableHead className="w-32 text-center">詳細</TableHead>
                  <TableHead className="w-40 text-center">
                    次のステップ
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map(({ original: exam }) => {
                  const workflow = getExamWorkflowStatus(
                    getExamProgress(exam),
                    exam.id
                  )
                  return (
                    <TableRow
                      key={exam.id}
                      className="group cursor-pointer"
                      onClick={() =>
                        toggleSelect(exam.id, !selectedIds.has(exam.id))
                      }
                    >
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedIds.has(exam.id)}
                          onCheckedChange={(checked) =>
                            toggleSelect(exam.id, checked === true)
                          }
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`${exam.examName}を選択`}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{exam.examName}</div>
                          {exam.tags.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {exam.tags.map((tag) => (
                                <Badge
                                  key={tag.id}
                                  variant="outline"
                                  className="text-xs font-normal"
                                  style={
                                    tag.color
                                      ? {
                                          borderColor: tag.color,
                                          color: tag.color,
                                        }
                                      : undefined
                                  }
                                >
                                  {tag.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm text-muted-foreground tabular-nums">
                        {exam.examDate
                          ? new Date(exam.examDate).toLocaleDateString("ja-JP")
                          : "—"}
                      </TableCell>

                      <TableCell
                        className="text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
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

                      <TableCell
                        className="text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="sm"
                          onClick={() => handleNextStep(workflow.url)}
                          className="w-48 justify-start rounded-lg text-left"
                        >
                          {workflow.step === 1 && (
                            <FileImage className="mr-1 h-4 w-4" />
                          )}
                          {workflow.step === 2 && (
                            <Settings className="mr-1 h-4 w-4" />
                          )}
                          {workflow.step === 3 && (
                            <Edit className="mr-1 h-4 w-4" />
                          )}
                          {workflow.step === 4 && (
                            <Calculator className="mr-1 h-4 w-4" />
                          )}
                          {workflow.step === 5 && (
                            <Users className="mr-1 h-4 w-4" />
                          )}
                          {workflow.step === 6 && (
                            <Upload className="mr-1 h-4 w-4" />
                          )}
                          {workflow.step === 7 && (
                            <PlayCircle className="mr-1 h-4 w-4" />
                          )}
                          {workflow.step === 8 && (
                            <Download className="mr-1 h-4 w-4" />
                          )}
                          <span className="text-xs">{workflow.text}</span>
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
