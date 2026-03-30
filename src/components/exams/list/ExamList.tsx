"use client"

import {
  Calculator,
  Download,
  Edit,
  Eye,
  FileImage,
  Filter,
  FolderInput,
  FolderOutput,
  PlayCircle,
  PlusCircle,
  Search,
  Settings,
  Tag,
  Upload,
  Users,
  X as XIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import ExportModeModal from "@/components/exams/detail/ExportModeModal"
import CreateExamWindow from "@/components/exams/forms/CreateExamWindow"
import { useExams } from "@/components/hooks/useExams"
import { useFileActions } from "@/components/hooks/useFileActions"
import { ImportWizardModal } from "@/components/import/ImportWizardModal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
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
import { useTableSort } from "@/hooks/useTableSort"
import type { ExamListItem } from "@/types/common.types"
import type { ExportMode } from "@/types/examArchive.types"

interface ExamSortable {
  id: string
  examName: string
  examDate: string | null
  original: ExamListItem
}

const File = () => {
  const { exams, loadExams } = useExams()
  const { user } = useAuth()
  const [showImportModal, setShowImportModal] = useState(false)
  const [selectedExamIds, setSelectedExamIds] = useState<Set<string>>(new Set())
  const [isBulkExporting, setIsBulkExporting] = useState(false)
  const [showBulkExportModal, setShowBulkExportModal] = useState(false)

  const [allTags, setAllTags] = useState<{ id: string; name: string }[]>([])
  const [bulkTagInput, setBulkTagInput] = useState("")
  const [showBulkTagPopover, setShowBulkTagPopover] = useState(false)
  const bulkTagInputRef = useRef<HTMLInputElement>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterTagIds, setFilterTagIds] = useState<Set<string>>(new Set())

  const { createExamModal } = useFileActions()
  const router = useRouter()

  // 既存タグ一覧を取得
  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await window.electronAPI.tagGetAll()
        setAllTags(tags)
      } catch {
        // ignore
      }
    }
    void loadTags()
  }, [])

  // フィルタリング
  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      // テキスト検索
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase()
        const nameMatch = exam.examName.toLowerCase().includes(term)
        const descMatch = exam.description?.toLowerCase().includes(term)
        const tagMatch = exam.tags.some((t) =>
          t.name.toLowerCase().includes(term)
        )
        if (!nameMatch && !descMatch && !tagMatch) return false
      }
      // タグフィルタ
      if (filterTagIds.size > 0) {
        const examTagIds = new Set(exam.tags.map((t) => t.id))
        const hasMatch = [...filterTagIds].some((id) => examTagIds.has(id))
        if (!hasMatch) return false
      }
      return true
    })
  }, [exams, searchTerm, filterTagIds])

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

  const handleBulkAddTag = useCallback(
    async (tagName: string) => {
      if (!tagName.trim() || selectedExamIds.size === 0) return
      try {
        const tag = await window.electronAPI.tagFindOrCreate(tagName.trim())
        for (const examId of selectedExamIds) {
          try {
            await window.electronAPI.examTagCreate({
              examId,
              tagId: tag.id,
            })
          } catch {
            // 既に紐づいている場合はunique制約で失敗するが無視
          }
        }
        toast.success("タグを追加しました", {
          description: `${selectedExamIds.size}件の試験に「${tagName.trim()}」を追加`,
        })
        setBulkTagInput("")
        setShowBulkTagPopover(false)
        setSelectedExamIds(new Set())
        // タグ一覧を再取得
        const tags = await window.electronAPI.tagGetAll()
        setAllTags(tags)
        loadExams()
      } catch (error) {
        toast.error("タグの追加に失敗しました")
        console.error(error)
      }
    },
    [selectedExamIds, loadExams]
  )

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
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
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
            {selectedExamIds.size > 0 && (
              <>
                <span className="text-muted-foreground text-sm">
                  {selectedExamIds.size}件選択中
                </span>
                <Popover
                  open={showBulkTagPopover}
                  onOpenChange={setShowBulkTagPopover}
                >
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="rounded-lg">
                      <Tag className="mr-2 h-4 w-4" />
                      タグを一括追加
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3" align="start">
                    <div className="space-y-2">
                      <p className="text-muted-foreground text-xs">
                        選択中の{selectedExamIds.size}
                        件にタグを追加
                      </p>
                      <Input
                        ref={bulkTagInputRef}
                        value={bulkTagInput}
                        onChange={(e) => setBulkTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                            e.preventDefault()
                            void handleBulkAddTag(bulkTagInput)
                          }
                        }}
                        placeholder="タグ名を入力してEnter"
                        className="h-8 text-sm"
                        autoFocus
                      />
                      {allTags.length > 0 && (
                        <div className="max-h-28 overflow-y-auto">
                          {allTags
                            .filter(
                              (t) =>
                                !bulkTagInput.trim() ||
                                t.name
                                  .toLowerCase()
                                  .includes(bulkTagInput.trim().toLowerCase())
                            )
                            .map((tag) => (
                              <button
                                key={tag.id}
                                type="button"
                                className="hover:bg-accent flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm"
                                onClick={() => void handleBulkAddTag(tag.name)}
                              >
                                <Tag className="h-3 w-3 opacity-50" />
                                {tag.name}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
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
          </div>

          {/* 検索・フィルタ */}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="試験名・タグで検索"
                className="h-8 w-48 pl-8 text-sm"
              />
            </div>
            {allTags.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={
                      filterTagIds.size > 0 ? "border-primary text-primary" : ""
                    }
                  >
                    <Filter className="mr-1.5 h-3.5 w-3.5" />
                    タグ
                    {filterTagIds.size > 0 && (
                      <Badge
                        variant="secondary"
                        className="ml-1.5 h-5 min-w-5 px-1 text-xs"
                      >
                        {filterTagIds.size}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="start">
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {allTags.map((tag) => (
                      <label
                        key={tag.id}
                        className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm"
                      >
                        <Checkbox
                          checked={filterTagIds.has(tag.id)}
                          onCheckedChange={(checked) => {
                            setFilterTagIds((prev) => {
                              const next = new Set(prev)
                              if (checked) {
                                next.add(tag.id)
                              } else {
                                next.delete(tag.id)
                              }
                              return next
                            })
                          }}
                        />
                        {tag.name}
                      </label>
                    ))}
                  </div>
                  {filterTagIds.size > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 w-full text-xs"
                      onClick={() => setFilterTagIds(new Set())}
                    >
                      <XIcon className="mr-1 h-3 w-3" />
                      フィルタをクリア
                    </Button>
                  )}
                </PopoverContent>
              </Popover>
            )}
            <span className="text-muted-foreground text-xs">
              {filteredExams.length === exams.length
                ? `${exams.length}件`
                : `${filteredExams.length} / ${exams.length}件`}
            </span>
          </div>
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
                  return (
                    <TableRow
                      key={exam.id}
                      className="group cursor-pointer"
                      onClick={() => handleToggleSelect(exam.id)}
                    >
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedExamIds.has(exam.id)}
                          onCheckedChange={() => handleToggleSelect(exam.id)}
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
                      <TableCell className="text-muted-foreground text-center text-sm tabular-nums">
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
