"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  FolderInput,
  FolderOutput,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

import {
  BulkTagAssignButton,
  BulkTagAssignPanel,
} from "@/components/common/BulkTagAssignButton"
import { EntityListPage } from "@/components/common/EntityListPage"
import {
  ClassroomFilterButton,
  DateRangeFilterButton,
  DateRangeFilterPanel,
  ListSearchInput,
  MultiSelectFilterPanel,
  TagFilterButton,
} from "@/components/common/ListFilterControls"
import type { ToolbarAction } from "@/components/common/OverflowToolbar"
import { usePageHelp } from "@/components/help/usePageHelp"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { TagWithAllRelations } from "@/electron-src/lib/prisma/tag"
import { type ListFilterAccessors, useListFilter } from "@/hooks/useListFilter"
import { useRowSelection } from "@/hooks/useRowSelection"
import { getCourseworkStatus } from "@/lib/courseworkStatus"
import { collectClassroomOptions } from "@/lib/filterOptions"
import {
  addTagToCourseworksMutation,
  analyzeCourseworkArchiveMutation,
  courseworkListQuery,
  deleteCourseworkMutation,
  exportCourseworkArchiveMutation,
  importCourseworkArchiveMutation,
  selectCourseworkImportFileMutation,
} from "@/queries/coursework"
import { findOrCreateTagMutation, tagListQuery } from "@/queries/tag"
import type { CourseworkSummary } from "@/types/coursework.types"
import type {
  CourseworkArchiveImportPreview,
  CourseworkImportDecision,
} from "@/types/courseworkArchive.types"
import type { ImportAction } from "@/types/importAction.types"

import { CourseworkCreateDialog } from "./CourseworkCreateDialog"
import { CourseworkImportDialog } from "./CourseworkImportDialog"

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
}

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_TAGS: TagWithAllRelations[] = []
const EMPTY_COURSEWORKS: CourseworkSummary[] = []

/**
 * 試験外成績資料（Coursework）の一覧コンテナ
 *
 * 列・当たり判定・並べ替え・空の出し分けは `EntityListPage` が1つだけ持つ。
 * ここが渡すのは「行1件から6つの列をどう作るか」と、ヘッダー右に並べる操作。
 * 成績算出から参照中の資料は削除をブロックし、参照元をトーストで通知する。
 */
export function CourseworkListContainer() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { helpButton } = usePageHelp()
  const deleteCoursework = useMutation(deleteCourseworkMutation())
  const exportArchive = useMutation(exportCourseworkArchiveMutation())
  const selectImportFile = useMutation(selectCourseworkImportFileMutation())
  const analyzeArchive = useMutation(analyzeCourseworkArchiveMutation())
  const importArchive = useMutation(importCourseworkArchiveMutation())
  const findOrCreateTag = useMutation(findOrCreateTagMutation())
  const addTagToCourseworks = useMutation(addTagToCourseworksMutation())
  const { data: courseworks = EMPTY_COURSEWORKS, isPending: isLoading } =
    useQuery(courseworkListQuery())
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  // インポート確認ウィザードの状態
  const [importPreview, setImportPreview] =
    useState<CourseworkArchiveImportPreview | null>(null)
  const [importArchivePath, setImportArchivePath] = useState<string | null>(
    null
  )
  const [importing, setImporting] = useState(false)
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

  const handleCreated = (id: string) => {
    setShowCreateDialog(false)
    // 作成直後は基本設定を促すため編集モーダルを開いた状態で開く
    router.push(`/coursework/${id}?setup=1`)
  }

  const handleDelete = async (coursework: CourseworkSummary) => {
    const result = await deleteCoursework.mutateAsync(coursework.id)
    if (!result.deleted) {
      toast.error("削除できません", {
        description: `次の成績算出で参照されています: ${result.usedBy.join("、")}`,
      })
      return
    }
    toast.success("資料を削除しました", { description: coursework.name })
  }

  const handleExport = (coursework: CourseworkSummary) => {
    exportArchive.mutate(coursework.id, {
      onSuccess: (result) => {
        if (!result.canceled) {
          toast.success("資料をエクスポートしました", {
            description: coursework.name,
          })
        }
      },
    })
  }

  // ヘッダーの並び（useMemo）から参照するので、参照を安定させる
  const handleImport = useCallback(async () => {
    const selected = await selectImportFile.mutateAsync()
    if (selected.canceled) return
    const preview = await analyzeArchive.mutateAsync({
      archivePath: selected.filePath,
    })
    setImportArchivePath(selected.filePath)
    setImportPreview(preview)
  }, [analyzeArchive, selectImportFile])

  const handleImportConfirm = async (
    decisions: Record<string, CourseworkImportDecision>,
    action: ImportAction
  ) => {
    if (!importArchivePath) return
    setImporting(true)
    try {
      const result = await importArchive.mutateAsync({
        archivePath: importArchivePath,
        courseworkDecisions: decisions,
        action,
      })
      if (result.warnings.length > 0) {
        toast.warning(
          `インポートは完了しましたが ${result.warnings.length} 件の警告があります`,
          {
            description: result.warnings.join("\n"),
            duration: Infinity,
            closeButton: true,
          }
        )
      } else {
        toast.success("資料をインポートしました")
      }
      await loadCourseworks()
    } catch (error) {
      toast.error("インポートに失敗しました", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setImporting(false)
      setImportPreview(null)
      setImportArchivePath(null)
    }
  }

  const handleImportCancel = () => {
    setImportPreview(null)
    setImportArchivePath(null)
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

  const dateRangeConfig = useMemo(
    () => ({
      label: "実施日",
      from: dateFrom,
      to: dateTo,
      onFromChange: setDateFrom,
      onToChange: setDateTo,
    }),
    [dateFrom, dateTo, setDateFrom, setDateTo]
  )

  const actions = useMemo<ToolbarAction[]>(() => {
    const toolbarActions: ToolbarAction[] = [
      {
        id: "create",
        priority: 80,
        node: (
          <Button
            onClick={() => setShowCreateDialog(true)}
            variant="outline"
            size="sm"
            className="rounded-lg"
          >
            <Plus className="mr-2 h-4 w-4" />
            新規作成
          </Button>
        ),
        collapsedNode: (
          <Button
            onClick={() => setShowCreateDialog(true)}
            variant="ghost"
            size="sm"
            className="w-full justify-start"
          >
            <Plus className="mr-2 h-4 w-4" />
            新規作成
          </Button>
        ),
      },
      {
        id: "import",
        priority: 70,
        node: (
          <Button
            onClick={handleImport}
            variant="outline"
            size="sm"
            className="rounded-lg"
          >
            <FolderInput className="mr-2 h-4 w-4" />
            .coursework 読み込み
          </Button>
        ),
        collapsedNode: (
          <Button
            onClick={handleImport}
            variant="ghost"
            size="sm"
            className="w-full justify-start"
          >
            <FolderInput className="mr-2 h-4 w-4" />
            .coursework 読み込み
          </Button>
        ),
      },
    ]

    if (selectedIds.size > 0) {
      toolbarActions.push({
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
      })
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
        id: "classroom-filter",
        priority: 85,
        node: <ClassroomFilterButton config={classroomFilterConfig} />,
        collapsedNode: (
          <div className="space-y-1">
            <p className="px-2 text-xs text-muted-foreground">学級で絞り込み</p>
            <MultiSelectFilterPanel config={classroomFilterConfig} />
          </div>
        ),
      },
      {
        id: "date-filter",
        priority: 84,
        node: <DateRangeFilterButton config={dateRangeConfig} />,
        collapsedNode: <DateRangeFilterPanel config={dateRangeConfig} />,
      },
      {
        // 検索欄は最後まで残す（検索できない一覧にしない）
        id: "search",
        priority: 100,
        node: (
          <ListSearchInput
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            placeholder="資料名・タグ・学級で検索"
          />
        ),
        collapsedNode: (
          <ListSearchInput
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
            placeholder="資料名・タグ・学級で検索"
          />
        ),
      }
    )

    return toolbarActions
  }, [
    allTags,
    classroomFilterConfig,
    dateRangeConfig,
    handleBulkAddTag,
    handleImport,
    searchTerm,
    selectedIds,
    setSearchTerm,
    tagFilterConfig,
  ])

  return (
    <>
      <EntityListPage<CourseworkSummary>
        title="試験外成績資料"
        helpButton={helpButton}
        rows={filteredCourseworks}
        totalCount={courseworks.length}
        isLoading={isLoading}
        name={(coursework) => coursework.name}
        summary={(coursework) => (
          <span className="flex flex-wrap items-center gap-1">
            <span>
              {coursework.description || "説明なし"}
              {" / 生徒: "}
              {coursework.students.length}名 / 評価項目:{" "}
              {coursework.items.length}
            </span>
            {coursework.tags.map((courseworkTag) => (
              <Badge
                key={courseworkTag.tag.id}
                variant="secondary"
                className="text-xs"
              >
                {courseworkTag.tag.name}
              </Badge>
            ))}
          </span>
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                aria-label={`${coursework.name}の操作`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport(coursework)}>
                <FolderOutput className="mr-2 h-4 w-4" />
                .coursework 書き出し
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => handleDelete(coursework)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                削除
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
          message: "試験外成績資料がありません",
          action: (
            <Button variant="outline" onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              最初の資料を作成
            </Button>
          ),
        }}
        noMatchMessage="条件に一致する資料がありません"
        sortStorageKey="courseworkList-sort"
      />

      <CourseworkCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreated={handleCreated}
      />

      <CourseworkImportDialog
        open={importPreview !== null}
        preview={importPreview}
        importing={importing}
        onCancel={handleImportCancel}
        onConfirm={handleImportConfirm}
      />
    </>
  )
}
