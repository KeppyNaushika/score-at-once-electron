"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  FolderInput,
  FolderOutput,
  MoreHorizontal,
  PlusCircle,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

import {
  BulkTagAssignButton,
  BulkTagAssignPanel,
} from "@/components/common/BulkTagAssignButton"
import { EntityListPage } from "@/components/common/EntityListPage"
import type { ExportOutcome } from "@/components/common/ExportResultSummary"
import {
  ListSearchInput,
  MultiSelectFilterPanel,
  TagFilterButton,
} from "@/components/common/ListFilterControls"
import type { ToolbarAction } from "@/components/common/OverflowToolbar"
import ExamArchiveExportModal from "@/components/exams/detail/ExamArchiveExportModal"
import { usePageHelp } from "@/components/help/usePageHelp"
import { ImportWizardModal } from "@/components/import/ImportWizardModal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import type { TagWithAllRelations } from "@/electron-src/lib/prisma/tag"
import { type ListFilterAccessors, useListFilter } from "@/hooks/useListFilter"
import { useRowSelection } from "@/hooks/useRowSelection"
import {
  type ExamSummary,
  getExamProgress,
  getExamWorkflowStatus,
} from "@/lib/examStatus"
import {
  bulkExportExamsMutation,
  exportExamArchiveMutation,
} from "@/queries/archive"
import { createExamMutation, examListQuery } from "@/queries/exam"
import {
  addTagToExamsMutation,
  findOrCreateTagMutation,
  tagListQuery,
} from "@/queries/tag"
import type { ArchiveExportMode } from "@/types/examArchive.types"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_TAGS: TagWithAllRelations[] = []
const EMPTY_EXAMS: ExamSummary[] = []

/** 試験一覧のフィルタ対象値の取り出し（検索=試験名・説明・タグ名、タグ絞り込み=タグ id） */
const EXAM_FILTER_ACCESSORS: ListFilterAccessors<ExamSummary> = {
  searchTexts: (exam) => [
    exam.examName,
    exam.description,
    ...exam.tags.map((tag) => tag.name),
  ],
  tagIds: (exam) => exam.tags.map((tag) => tag.id),
}

/**
 * 書き出しの相手。
 *
 * 1件（行の「…」から）とまとめて（選択してから）で同じモーダルを使う。相手が
 * 誰なのかを1つの state に持つことで、モーダルが開いている間に選択が変わっても
 * 押した時点の相手へ書き出す。
 */
type ExportTarget =
  | { kind: "single"; examId: string; examName: string }
  | { kind: "bulk"; examIds: string[] }

const ExamList = () => {
  const currentUser = useCurrentUser()
  const queryClient = useQueryClient()
  const { helpButton } = usePageHelp()
  const { data: exams = EMPTY_EXAMS, isPending: isLoading } = useQuery(
    examListQuery(currentUser.id)
  )
  const loadExams = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: examListQuery(currentUser.id).queryKey,
      }),
    [queryClient, currentUser.id]
  )
  const { data: allTags = EMPTY_TAGS } = useQuery(tagListQuery())
  const findOrCreateTag = useMutation(findOrCreateTagMutation())
  const addTagToExams = useMutation(addTagToExamsMutation())
  const bulkExportExams = useMutation(bulkExportExamsMutation())
  const exportExamArchive = useMutation(exportExamArchiveMutation())
  const [showImportModal, setShowImportModal] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportTarget, setExportTarget] = useState<ExportTarget | null>(null)
  /** 書き出しの結果。渡している間はモーダルが結果の段を見せる */
  const [exportOutcome, setExportOutcome] = useState<ExportOutcome | null>(null)

  const createExam = useMutation(createExamMutation(currentUser.id))
  const router = useRouter()

  /**
   * 新規作成。**ダイアログを出さずに既定値の1件を作り、その概要ページへ直行する。**
   *
   * 名前・試験日・説明・タグは概要ページでその場で編集できるので、作る前に訊く
   * ことが無い。訊いていた頃は「作成は通ったがタグ付けで失敗した」という**途中まで
   * 成功した状態**が生まれ、作り直しを避けるために作った試験を覚えておく必要があった
   * （その覚えのせいで、名前を直して押し直しても名前が反映されなかった）。
   *
   * id は renderer が振る（規約）。失敗したときは遷移しない。
   */
  const handleCreate = useCallback(async () => {
    const examId = crypto.randomUUID()
    try {
      await createExam.mutateAsync({ id: examId, examName: "新しい試験" })
      router.push(`/exams/${examId}`)
    } catch {
      // 失敗の通知は MutationCache が出す
    }
  }, [createExam, router])

  const {
    filteredItems: filteredExams,
    searchTerm,
    setSearchTerm,
    filterTagIds,
    toggleTagId,
    clearTagIds,
  } = useListFilter(exams, EXAM_FILTER_ACCESSORS)

  const {
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    allSelected,
    clearSelection,
  } = useRowSelection(filteredExams)

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

  const handleExport = useCallback(
    async (exportMode: ArchiveExportMode) => {
      if (exportTarget === null) return

      setIsExporting(true)
      toast("書き出し中...", {
        description:
          exportTarget.kind === "single"
            ? `「${exportTarget.examName}」を書き出しています。`
            : `${exportTarget.examIds.length}件の試験を書き出しています。`,
      })

      try {
        if (exportTarget.kind === "single") {
          const exportResult = await exportExamArchive.mutateAsync({
            examId: exportTarget.examId,
            userId: currentUser.id,
            exportMode,
          })
          // 保存先を選ばずに閉じたのは失敗ではないので、何も言わない
          if (exportResult.canceled) return
          setExportOutcome({
            archives: [
              {
                sourceId: exportTarget.examId,
                sourceName: exportTarget.examName,
                outputPath: exportResult.outputPath,
                missingFiles: exportResult.missingFiles ?? [],
              },
            ],
            failures: [],
          })
          return
        }

        const bulkResult = await bulkExportExams.mutateAsync({
          examIds: exportTarget.examIds,
          userId: currentUser.id,
          exportMode,
        })
        if (bulkResult.canceled) return

        // 結果はモーダルの中で見せる。**欠けたファイルも試験ごとの失敗も落とさない**。
        // 書き出し中に閉じられていても、結果は見せる
        setExportOutcome({
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
        setIsExporting(false)
      }
    },
    [
      currentUser.id,
      exportTarget,
      clearSelection,
      bulkExportExams,
      exportExamArchive,
    ]
  )

  /** 閉じたら相手も結果も捨てる（次に開いたときは選択の段から始まる） */
  const handleExportModalOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setExportTarget(null)
      setExportOutcome(null)
    }
  }, [])

  const tagFilterConfig = useMemo(
    () => ({
      options: allTags,
      selectedIds: filterTagIds,
      onToggle: toggleTagId,
      onClear: clearTagIds,
    }),
    [allTags, filterTagIds, toggleTagId, clearTagIds]
  )

  const actions = useMemo<ToolbarAction[]>(() => {
    const toolbarActions: ToolbarAction[] = [
      {
        id: "create",
        priority: 80,
        node: (
          <Button
            onClick={() => void handleCreate()}
            variant="outline"
            size="sm"
            className="rounded-lg"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            新規試験作成
          </Button>
        ),
        collapsedNode: (
          <Button
            onClick={() => void handleCreate()}
            variant="ghost"
            size="sm"
            className="w-full justify-start"
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            新規試験作成
          </Button>
        ),
      },
      {
        id: "import",
        priority: 70,
        node: (
          <Button
            onClick={() => setShowImportModal(true)}
            variant="outline"
            size="sm"
            className="rounded-lg"
          >
            <FolderInput className="mr-2 h-4 w-4" />
            .score 読み込み
          </Button>
        ),
        collapsedNode: (
          <Button
            onClick={() => setShowImportModal(true)}
            variant="ghost"
            size="sm"
            className="w-full justify-start"
          >
            <FolderInput className="mr-2 h-4 w-4" />
            .score 読み込み
          </Button>
        ),
      },
    ]

    if (selectedIds.size > 0) {
      // 選択中だけ現れる操作。幅が急に増えるが、畳みは実測なので自然に吸収される
      toolbarActions.push(
        {
          id: "bulk-tag",
          priority: 60,
          node: (
            <BulkTagAssignButton
              selectedCount={selectedIds.size}
              allTags={allTags}
              onAssign={handleBulkAddTag}
            />
          ),
          collapsedNode: (
            <BulkTagAssignPanel
              selectedCount={selectedIds.size}
              allTags={allTags}
              onAssign={handleBulkAddTag}
            />
          ),
        },
        {
          id: "bulk-export",
          priority: 50,
          node: (
            <Button
              onClick={() =>
                setExportTarget({ kind: "bulk", examIds: [...selectedIds] })
              }
              variant="outline"
              size="sm"
              className="rounded-lg"
              disabled={isExporting}
            >
              <FolderOutput className="mr-2 h-4 w-4" />
              .score 一括書き出し（{selectedIds.size}件）
            </Button>
          ),
          collapsedNode: (
            <Button
              onClick={() =>
                setExportTarget({ kind: "bulk", examIds: [...selectedIds] })
              }
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              disabled={isExporting}
            >
              <FolderOutput className="mr-2 h-4 w-4" />
              .score 一括書き出し（{selectedIds.size}件）
            </Button>
          ),
        }
      )
    }

    toolbarActions.push(
      {
        id: "tag-filter",
        priority: 90,
        node: <TagFilterButton config={tagFilterConfig} />,
        collapsedNode: (
          <div className="space-y-1">
            <p className="px-2 text-xs text-muted-foreground">タグで絞り込み</p>
            <MultiSelectFilterPanel config={tagFilterConfig} />
          </div>
        ),
      },
      {
        // 検索欄は最後まで残す（検索できない一覧にしない）
        id: "search",
        priority: 100,
        node: (
          <ListSearchInput
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            placeholder="試験名・タグで検索"
          />
        ),
        collapsedNode: (
          <ListSearchInput
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            placeholder="試験名・タグで検索"
          />
        ),
      }
    )

    return toolbarActions
  }, [
    allTags,
    handleBulkAddTag,
    handleCreate,
    isExporting,
    searchTerm,
    selectedIds,
    setSearchTerm,
    tagFilterConfig,
  ])

  return (
    <>
      <ImportWizardModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onComplete={handleImportComplete}
      />
      <ExamArchiveExportModal
        open={exportTarget !== null}
        onOpenChange={handleExportModalOpenChange}
        onExport={handleExport}
        isExporting={isExporting}
        exportOutcome={exportOutcome}
      />
      <EntityListPage<ExamSummary>
        title="試験一覧"
        helpButton={helpButton}
        rows={filteredExams}
        totalCount={exams.length}
        isLoading={isLoading}
        name={(exam) => exam.examName}
        summary={(exam) => (
          <span className="flex flex-wrap items-center gap-1">
            <span>{exam.description || "説明なし"}</span>
            {exam.tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
                className="text-xs font-normal"
                style={
                  tag.color
                    ? { borderColor: tag.color, color: tag.color }
                    : undefined
                }
              >
                {tag.name}
              </Badge>
            ))}
          </span>
        )}
        dateLabel="試験日"
        referenceDate={(exam) => exam.referenceDate}
        updatedAt={(exam) => exam.updatedAt}
        overviewUrl={(exam) => `/exams/${exam.id}`}
        nextStep={(exam) => {
          const workflow = getExamWorkflowStatus(getExamProgress(exam), exam.id)
          return { label: workflow.text, url: workflow.url }
        }}
        rowMenu={(exam) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={`${exam.examName}の操作`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  setExportTarget({
                    kind: "single",
                    examId: exam.id,
                    examName: exam.examName,
                  })
                }
              >
                <FolderOutput className="mr-2 h-4 w-4" />
                .score 書き出し
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        actions={actions}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        allSelected={allSelected}
        empty={{
          message: "まだ試験がありません",
          action: (
            <Button variant="outline" onClick={() => void handleCreate()}>
              <PlusCircle className="mr-2 h-4 w-4" />
              最初の試験を作成
            </Button>
          ),
        }}
        noMatchMessage="条件に一致する試験がありません"
        sortStorageKey="examList-sort"
      />
    </>
  )
}

export default ExamList
