"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { FileArchive, PencilSparkles, PlusCircle } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

import { ArchiveImportScreens } from "@/components/archive-import/ArchiveImportScreens"
import { archiveImportToolbarAction } from "@/components/archive-import/archiveImportToolbarAction"
import { useArchiveImportLauncher } from "@/components/archive-import/hooks/useArchiveImportLauncher"
import { bulkTagToolbarAction } from "@/components/common/BulkTagAssignButton"
import { EntityListPage } from "@/components/common/EntityListPage"
import {
  type ToolbarAction,
  toolbarButtonAction,
} from "@/components/common/OverflowToolbar"
import { Button } from "@/components/ui/button"
import type { UnifiedArchiveExportInitialSelection } from "@/components/unified-archive/export/types"
import { UnifiedArchiveExportDialog } from "@/components/unified-archive/export/UnifiedArchiveExportDialog"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import type { TagWithAllRelations } from "@/electron-src/lib/prisma/tag"
import { type ListFilterAccessors, useListFilter } from "@/hooks/useListFilter"
import { useRowSelection } from "@/hooks/useRowSelection"
import {
  type ExamSummary,
  getExamProgress,
  getExamWorkflowStatus,
} from "@/lib/examStatus"
import { createExamMutation, examListQuery } from "@/queries/exam"
import {
  addTagToExamsMutation,
  findOrCreateTagMutation,
  tagListQuery,
} from "@/queries/tag"

import { ExamRowMenu } from "./ExamRowMenu"
import { ExamRowSummary } from "./ExamRowSummary"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_TAGS: TagWithAllRelations[] = []
const EMPTY_EXAMS: ExamSummary[] = []

/** 試験一覧のフィルタ対象値の取り出し（列見出しの popover が絞る先） */
const EXAM_FILTER_ACCESSORS: ListFilterAccessors<ExamSummary> = {
  searchTexts: (exam) => [
    exam.examName,
    exam.description,
    ...exam.tags.map((tag) => tag.name),
  ],
  tagIds: (exam) => exam.tags.map((tag) => tag.id),
  date: (exam) => exam.referenceDate,
  updatedAt: (exam) => exam.updatedAt,
}

const ExamList = () => {
  const currentUser = useCurrentUser()
  const { data: exams = EMPTY_EXAMS, isPending: isLoading } = useQuery(
    examListQuery(currentUser.id)
  )
  const { data: allTags = EMPTY_TAGS } = useQuery(tagListQuery())
  const findOrCreateTag = useMutation(findOrCreateTagMutation())
  const addTagToExams = useMutation(addTagToExamsMutation())
  const archiveImport = useArchiveImportLauncher()
  const { start: startArchiveImport, isOpening: isOpeningArchive } =
    archiveImport
  /** .sao 書き出しを開いたときの最初の選択。null の間は閉じている */
  const [unifiedExportSelection, setUnifiedExportSelection] =
    useState<UnifiedArchiveExportInitialSelection | null>(null)

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
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    updatedFrom,
    setUpdatedFrom,
    updatedTo,
    setUpdatedTo,
  } = useListFilter(exams, EXAM_FILTER_ACCESSORS)

  const {
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    allSelected,
    clearSelection,
  } = useRowSelection(filteredExams)

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
      toolbarButtonAction({
        id: "create",
        priority: 80,
        icon: PlusCircle,
        label: "新規試験作成",
        onClick: () => void handleCreate(),
      }),
      archiveImportToolbarAction({
        priority: 70,
        isOpening: isOpeningArchive,
        onClick: () => void startArchiveImport(),
      }),
    ]

    if (selectedIds.size > 0) {
      // 選択中だけ現れる操作。幅が急に増えるが、畳みは実測なので自然に吸収される
      toolbarActions.push(
        bulkTagToolbarAction({
          priority: 60,
          selectedCount: selectedIds.size,
          allTags,
          onAssign: handleBulkAddTag,
        }),
        toolbarButtonAction({
          id: "bulk-unified-export",
          priority: 50,
          icon: FileArchive,
          label: `.sao 書き出し（${selectedIds.size}件）`,
          onClick: () =>
            setUnifiedExportSelection({ roots: { Exam: [...selectedIds] } }),
        })
      )
    }

    return toolbarActions
  }, [
    allTags,
    handleBulkAddTag,
    handleCreate,
    isOpeningArchive,
    selectedIds,
    startArchiveImport,
  ])

  return (
    <>
      <ArchiveImportScreens launcher={archiveImport} />
      <UnifiedArchiveExportDialog
        open={unifiedExportSelection !== null}
        onOpenChange={(open) => {
          if (!open) setUnifiedExportSelection(null)
        }}
        initialSelection={unifiedExportSelection ?? {}}
      />
      <EntityListPage<ExamSummary>
        title="試験一覧"
        rows={filteredExams}
        totalCount={exams.length}
        isLoading={isLoading}
        name={(exam) => exam.examName}
        summary={(exam) => <ExamRowSummary exam={exam} />}
        dateLabel="試験日"
        referenceDate={(exam) => exam.referenceDate}
        updatedAt={(exam) => exam.updatedAt}
        overviewUrl={(exam) => `/exams/${exam.id}`}
        nextStep={(exam) => {
          const workflow = getExamWorkflowStatus(getExamProgress(exam), exam.id)
          return { label: workflow.text, url: workflow.url }
        }}
        rowMenu={(exam) => (
          <ExamRowMenu
            exam={exam}
            onUnifiedExport={() =>
              setUnifiedExportSelection({ roots: { Exam: [exam.id] } })
            }
          />
        )}
        actions={actions}
        search={{
          term: searchTerm,
          onChange: setSearchTerm,
          placeholder: "試験名・タグで検索",
        }}
        tagFilter={tagFilterConfig}
        dateFilter={{
          from: dateFrom,
          to: dateTo,
          onFromChange: setDateFrom,
          onToChange: setDateTo,
        }}
        updatedAtFilter={{
          from: updatedFrom,
          to: updatedTo,
          onFromChange: setUpdatedFrom,
          onToChange: setUpdatedTo,
        }}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        allSelected={allSelected}
        empty={{
          icon: PencilSparkles,
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
