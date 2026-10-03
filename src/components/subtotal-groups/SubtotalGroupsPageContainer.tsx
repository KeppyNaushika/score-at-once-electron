"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Calculator, Plus } from "lucide-react"
import { useCallback, useEffect, useState } from "react"

import {
  ListSearchInput,
  MultiSelectFilterPanel,
  TagFilterButton,
} from "@/components/common/ListFilterControls"
import {
  type ToolbarAction,
  toolbarButtonAction,
} from "@/components/common/OverflowToolbar"
import PageHeader from "@/components/layout/PageHeader"
import { DeleteSubtotalGroupModal } from "@/components/subtotal-groups/components/DeleteSubtotalGroupModal"
import { SubtotalGroupCard } from "@/components/subtotal-groups/components/SubtotalGroupCard"
import { SubtotalGroupModal } from "@/components/subtotal-groups/components/SubtotalGroupModal"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import type { TagWithAllRelations } from "@/electron-src/lib/prisma/tag"
import { useDialogTarget } from "@/hooks/useDialogTarget"
import { type ListFilterAccessors, useListFilter } from "@/hooks/useListFilter"
import {
  subtotalGroupListQuery,
  type SubtotalGroupRow,
} from "@/queries/subtotal"
import { tagListQuery } from "@/queries/tag"

/** 小計点グループ一覧のフィルタ対象（グループ名・小計項目名・タグ名で検索、タグで絞り込み） */
const SUBTOTAL_GROUP_FILTER_ACCESSORS: ListFilterAccessors<SubtotalGroupRow> = {
  searchTexts: (subtotalGroup) => [
    subtotalGroup.name,
    ...subtotalGroup.subtotals.map((subtotal) => subtotal.name),
    ...subtotalGroup.tagSubtotalGroups.map(
      (tagSubtotalGroup) => tagSubtotalGroup.tag.name
    ),
  ],
  tagIds: (subtotalGroup) =>
    subtotalGroup.tagSubtotalGroups.map(
      (tagSubtotalGroup) => tagSubtotalGroup.tag.id
    ),
}

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_TAGS: TagWithAllRelations[] = []
const EMPTY_SUBTOTAL_GROUPS: SubtotalGroupRow[] = []

export function SubtotalGroupsPageContainer() {
  const [showModal, setShowModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<SubtotalGroupRow | null>(
    null
  )

  const queryClient = useQueryClient()
  const {
    data: subtotalGroups = EMPTY_SUBTOTAL_GROUPS,
    isPending: loading,
    error,
  } = useQuery(subtotalGroupListQuery())
  const ipcError = error?.message ?? null
  // 削除の確認を開いているグループ
  const groupDeletion = useDialogTarget<SubtotalGroupRow>()

  const fetchSubtotalGroups = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: subtotalGroupListQuery().queryKey,
      }),
    [queryClient]
  )

  // 既存タグ一覧（タグフィルタの選択肢）
  const { data: allTags = EMPTY_TAGS } = useQuery(tagListQuery())

  const {
    filteredItems: filteredGroups,
    searchTerm,
    setSearchTerm,
    filterTagIds,
    toggleTagId,
    clearTagIds,
  } = useListFilter(subtotalGroups, SUBTOTAL_GROUP_FILTER_ACCESSORS)

  // 新規作成
  const handleCreate = useCallback(() => {
    setEditingGroup(null)
    setShowModal(true)
  }, [])

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // モーダルが開いている時は無視
      if (showModal || groupDeletion.isOpen) return

      if ((event.ctrlKey || event.metaKey) && event.key === "n") {
        event.preventDefault()
        handleCreate()
      }

      if (event.key === "F5" || (event.ctrlKey && event.key === "r")) {
        event.preventDefault()
        fetchSubtotalGroups()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [groupDeletion.isOpen, fetchSubtotalGroups, handleCreate, showModal])

  // 編集
  const handleEdit = (group: SubtotalGroupRow) => {
    setEditingGroup(group)
    setShowModal(true)
  }

  const tagFilter = {
    options: allTags,
    selectedIds: filterTagIds,
    onToggle: toggleTagId,
    onClear: clearTagIds,
  }
  const searchPlaceholder = "グループ名、小計項目名、タグで検索"
  const toolbarActions: ToolbarAction[] = [
    {
      id: "search",
      priority: 90,
      node: (
        <ListSearchInput
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          placeholder={searchPlaceholder}
        />
      ),
      collapsedNode: (
        <ListSearchInput
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          placeholder={searchPlaceholder}
          className="w-full"
        />
      ),
    },
    {
      id: "tag-filter",
      priority: 85,
      node: <TagFilterButton config={tagFilter} />,
      collapsedNode: <MultiSelectFilterPanel config={tagFilter} />,
    },
    toolbarButtonAction({
      id: "create",
      priority: 80,
      icon: Plus,
      label: "新規作成",
      onClick: handleCreate,
    }),
  ]

  return (
    <div className="flex h-full min-w-full flex-col">
      <PageHeader
        title="小計点グループ管理"
        subtitle={
          loading
            ? undefined
            : filteredGroups.length === subtotalGroups.length
              ? `${subtotalGroups.length}件`
              : `${filteredGroups.length} / ${subtotalGroups.length}件`
        }
        actions={toolbarActions}
      />

      {/* エラーメッセージ */}
      {ipcError && (
        <div className="mx-4 mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
          <div className="mb-2 font-medium text-red-800">接続エラー</div>
          <div className="text-sm text-red-700">{ipcError}</div>
          <Button
            onClick={fetchSubtotalGroups}
            className="mt-3"
            variant="outline"
            size="sm"
          >
            再試行
          </Button>
        </div>
      )}

      {/* グループ一覧 */}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner className="size-6" />
          </div>
        ) : !ipcError && filteredGroups.length === 0 ? (
          <Empty className="h-full rounded-lg border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Calculator />
              </EmptyMedia>
              <EmptyTitle>
                {subtotalGroups.length > 0
                  ? "検索結果が見つかりません"
                  : "小計点グループがありません"}
              </EmptyTitle>
            </EmptyHeader>
            {subtotalGroups.length === 0 && (
              <EmptyContent>
                <Button variant="outline" onClick={handleCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  最初のグループを作成
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredGroups.map((group) => (
              <SubtotalGroupCard
                key={group.id}
                group={group}
                onEdit={() => handleEdit(group)}
                onDelete={() => groupDeletion.openWith(group)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 削除確認。成績算出・設問で使われていれば断る */}
      <DeleteSubtotalGroupModal
        open={groupDeletion.isOpen}
        group={groupDeletion.target}
        onClose={groupDeletion.close}
      />

      {/* モーダル */}
      {showModal && (
        <SubtotalGroupModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          editingGroup={editingGroup}
        />
      )}
    </div>
  )
}
