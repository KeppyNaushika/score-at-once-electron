"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ClipboardList, Plus } from "lucide-react"
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
import type { TagWithAllRelations } from "@/electron-src/lib/prisma/tag"
import { useDialogTarget } from "@/hooks/useDialogTarget"
import { type ListFilterAccessors, useListFilter } from "@/hooks/useListFilter"
import { useRowSelection } from "@/hooks/useRowSelection"
import { getCourseworkStatus } from "@/lib/courseworkStatus"
import { collectClassroomOptions } from "@/lib/filterOptions"
import {
  addTagToCourseworksMutation,
  courseworkListQuery,
  createCourseworkMutation,
  deleteCourseworkMutation,
} from "@/queries/coursework"
import { findOrCreateTagMutation, tagListQuery } from "@/queries/tag"
import type { CourseworkSummary } from "@/types/coursework.types"

import { DeleteCourseworkModal } from "../DeleteCourseworkModal"
import { CourseworkRowMenu } from "./CourseworkRowMenu"
import { CourseworkRowSummary } from "./CourseworkRowSummary"

/** 試験外成績資料一覧のフィルタ対象値（名前・説明・タグ名・学級名／タグ／学級／実施日） */
const COURSEWORK_FILTER_ACCESSORS: ListFilterAccessors<CourseworkSummary> = {
  searchTexts: (coursework) => [
    coursework.name,
    coursework.description,
    ...coursework.tags.map((courseworkTag) => courseworkTag.tag.name),
    ...coursework.classrooms.map(
      (courseworkClassroom) => courseworkClassroom.classroom.name
    ),
  ],
  tagIds: (coursework) =>
    coursework.tags.map((courseworkTag) => courseworkTag.tag.id),
  classroomIds: (coursework) =>
    coursework.classrooms.map(
      (courseworkClassroom) => courseworkClassroom.classroomId
    ),
  date: (coursework) => coursework.referenceDate,
  updatedAt: (coursework) => coursework.updatedAt,
}

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_TAGS: TagWithAllRelations[] = []
const EMPTY_COURSEWORKS: CourseworkSummary[] = []

/**
 * 試験外成績資料（Coursework）の一覧コンテナ
 *
 * 列・当たり判定・並べ替え・空の出し分けは `EntityListPage` が1つだけ持つ。
 * ここが渡すのは「行1件から6つの列をどう作るか」と、ヘッダー右に並べる操作。
 * 削除は確認（`DeleteCourseworkModal`）を通してから行う。成績算出から参照中の
 * 資料は削除をブロックし、参照元をトーストで通知する。
 */
export function CourseworkListContainer() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const deleteCoursework = useMutation(deleteCourseworkMutation())
  const findOrCreateTag = useMutation(findOrCreateTagMutation())
  const addTagToCourseworks = useMutation(addTagToCourseworksMutation())
  const createCoursework = useMutation(createCourseworkMutation())
  const { data: courseworks = EMPTY_COURSEWORKS, isPending: isLoading } =
    useQuery(courseworkListQuery())
  const archiveImport = useArchiveImportLauncher()
  const { start: startArchiveImport, isOpening: isOpeningArchive } =
    archiveImport
  /** .sao 書き出しを開いたときの最初の選択。null の間は閉じている */
  const [unifiedExportSelection, setUnifiedExportSelection] =
    useState<UnifiedArchiveExportInitialSelection | null>(null)
  // 押しただけでは消さず、確認で決めてもらう
  const courseworkDeletion = useDialogTarget<CourseworkSummary>()
  const { data: allTags = EMPTY_TAGS } = useQuery(tagListQuery())
  const refreshTags = useCallback(
    () => queryClient.invalidateQueries({ queryKey: tagListQuery().queryKey }),
    [queryClient]
  )

  const loadCourseworks = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: courseworkListQuery().queryKey,
      }),
    [queryClient]
  )

  /**
   * 新規作成。**ダイアログを出さずに既定値の1件を作り、その概要ページへ直行する。**
   *
   * 名前・実施日・説明・タグは概要ページでその場で編集できるので、作る前に訊く
   * ことが無い。作成直後に基本設定を促すために編集モーダルを自動で開いていた
   * （`?setup=1`）のも、開く先が概要ページそのものになったので要らない。
   *
   * id は renderer が振る（規約）。失敗したときは遷移しない。
   */
  const handleCreate = useCallback(async () => {
    const courseworkId = crypto.randomUUID()
    try {
      await createCoursework.mutateAsync({
        id: courseworkId,
        name: "新しい資料",
      })
      router.push(`/coursework/${courseworkId}`)
    } catch {
      // 失敗の通知は MutationCache が出す
    }
  }, [createCoursework, router])

  const handleDelete = async (coursework: CourseworkSummary) => {
    try {
      await deleteCoursework.mutateAsync(coursework.id)
    } catch {
      // 失敗の通知（成績算出で使われていて断られたときも）は MutationCache が出す。
      // 確認は開いたままにする
      return
    }
    courseworkDeletion.close()
    toast.success("資料を削除しました", { description: coursework.name })
  }

  const classroomOptions = useMemo(
    () =>
      collectClassroomOptions(courseworks, (coursework) =>
        coursework.classrooms.map(
          (courseworkClassroom) => courseworkClassroom.classroom
        )
      ),
    [courseworks]
  )

  const {
    filteredItems: filteredCourseworks,
    searchTerm,
    setSearchTerm,
    filterTagIds,
    toggleTagId,
    clearTagIds,
    filterClassroomIds,
    toggleClassroomId,
    clearClassroomIds,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    updatedFrom,
    setUpdatedFrom,
    updatedTo,
    setUpdatedTo,
  } = useListFilter(courseworks, COURSEWORK_FILTER_ACCESSORS)

  const {
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    allSelected,
    clearSelection,
  } = useRowSelection(filteredCourseworks)

  // 選択中の各資料へ、既存タグを保持したままタグを追加する
  const handleBulkAddTag = useCallback(
    async (tagName: string) => {
      try {
        const tag = await findOrCreateTag.mutateAsync(tagName)
        const targetCourseworks = courseworks.filter((coursework) =>
          selectedIds.has(coursework.id)
        )
        // 既存タグを保持したまま1件ずつ追加（全置換 setTags による stale 消失を回避）
        await addTagToCourseworks.mutateAsync({
          courseworkIds: targetCourseworks.map((coursework) => coursework.id),
          tagId: tag.id,
        })
        toast.success("タグを追加しました", {
          description: `${targetCourseworks.length}件の資料に「${tagName}」を追加`,
        })
        clearSelection()
        await refreshTags()
        await loadCourseworks()
      } catch (error) {
        console.error("Error bulk adding tag:", error)
        toast.error("タグの追加に失敗しました")
      }
    },
    [
      addTagToCourseworks,
      clearSelection,
      courseworks,
      findOrCreateTag,
      loadCourseworks,
      refreshTags,
      selectedIds,
    ]
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

  const classroomFilterConfig = useMemo(
    () => ({
      options: classroomOptions,
      selectedIds: filterClassroomIds,
      onToggle: toggleClassroomId,
      onClear: clearClassroomIds,
    }),
    [classroomOptions, filterClassroomIds, toggleClassroomId, clearClassroomIds]
  )

  const actions = useMemo<ToolbarAction[]>(() => {
    const toolbarActions: ToolbarAction[] = [
      toolbarButtonAction({
        id: "create",
        priority: 80,
        icon: Plus,
        label: "新規作成",
        onClick: () => void handleCreate(),
      }),
      archiveImportToolbarAction({
        priority: 70,
        isOpening: isOpeningArchive,
        onClick: () => void startArchiveImport(),
      }),
    ]

    if (selectedIds.size > 0) {
      toolbarActions.push(
        bulkTagToolbarAction({
          priority: 60,
          selectedCount: selectedIds.size,
          allTags,
          onAssign: handleBulkAddTag,
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
      <EntityListPage<CourseworkSummary>
        title="試験外成績資料"
        rows={filteredCourseworks}
        totalCount={courseworks.length}
        isLoading={isLoading}
        name={(coursework) => coursework.name}
        summary={(coursework) => (
          <CourseworkRowSummary coursework={coursework} />
        )}
        dateLabel="実施日"
        referenceDate={(coursework) => coursework.referenceDate}
        updatedAt={(coursework) => coursework.updatedAt}
        overviewUrl={(coursework) => `/coursework/${coursework.id}`}
        nextStep={(coursework) => {
          const status = getCourseworkStatus(coursework)
          return { label: status.text, url: status.url }
        }}
        rowMenu={(coursework) => (
          <CourseworkRowMenu
            coursework={coursework}
            onUnifiedExport={() =>
              setUnifiedExportSelection({
                roots: { Coursework: [coursework.id] },
              })
            }
            onRequestDelete={() => courseworkDeletion.openWith(coursework)}
          />
        )}
        actions={actions}
        search={{
          term: searchTerm,
          onChange: setSearchTerm,
          placeholder: "資料名・タグ・学級で検索",
        }}
        tagFilter={tagFilterConfig}
        classroomFilter={classroomFilterConfig}
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
          icon: ClipboardList,
          message: "試験外成績資料がありません",
          action: (
            <Button variant="outline" onClick={() => void handleCreate()}>
              <Plus className="mr-2 h-4 w-4" />
              最初の資料を作成
            </Button>
          ),
        }}
        noMatchMessage="条件に一致する資料がありません"
        sortStorageKey="courseworkList-sort"
      />

      <DeleteCourseworkModal
        open={courseworkDeletion.isOpen}
        target={courseworkDeletion.target}
        onClose={courseworkDeletion.close}
        onConfirm={() =>
          courseworkDeletion.target
            ? handleDelete(courseworkDeletion.target)
            : undefined
        }
        loading={deleteCoursework.isPending}
      />

      <UnifiedArchiveExportDialog
        open={unifiedExportSelection !== null}
        onOpenChange={(open) => {
          if (!open) setUnifiedExportSelection(null)
        }}
        initialSelection={unifiedExportSelection ?? {}}
      />

      <ArchiveImportScreens launcher={archiveImport} />
    </>
  )
}
