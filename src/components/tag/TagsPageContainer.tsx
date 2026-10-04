"use client"

import type { DragEndEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { useMutation, useQuery } from "@tanstack/react-query"
import { PlusCircle, Tag } from "lucide-react"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import {
  type ToolbarAction,
  toolbarButtonAction,
} from "@/components/common/OverflowToolbar"
import { SortableTableProvider } from "@/components/common/sortable-table/SortableTableProvider"
import PageHeader from "@/components/layout/PageHeader"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { buttonVariants } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { TagWithAllRelations } from "@/electron-src/lib/prisma/tag"
import { useDialogTarget } from "@/hooks/useDialogTarget"
import {
  createTagMutation,
  deleteTagMutation,
  reorderTagsMutation,
  tagListQuery,
  tagSubtotalGroupsQuery,
  updateTagMutation,
} from "@/queries/tag"

import { SortableTagRow } from "./SortableTagRow"
import { TagModal } from "./TagModal"
import { formatTagUsage } from "./tagUsage"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_TAGS: TagWithAllRelations[] = []

export function TagsPageContainer() {
  const { data: tags = EMPTY_TAGS, isPending: loading } =
    useQuery(tagListQuery())
  const createTag = useMutation(createTagMutation())
  const updateTag = useMutation(updateTagMutation())
  const deleteTag = useMutation(deleteTagMutation())
  const reorderTags = useMutation(reorderTagsMutation())
  const [modalTag, setModalTag] = useState<TagWithAllRelations | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [expandedTagId, setExpandedTagId] = useState<string | null>(null)
  const tagDeletion = useDialogTarget<TagWithAllRelations>()

  // 紐づく小計点グループは開いたタグの分だけ引く
  const { data: linkedSubtotalGroups = null } = useQuery({
    ...tagSubtotalGroupsQuery(expandedTagId ?? ""),
    enabled: expandedTagId !== null,
  })

  /** 並べ替え。掴んでいる間はライブラリが持ち、離したときに1回書く */
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = tags.findIndex((tag) => tag.id === active.id)
      const newIndex = tags.findIndex((tag) => tag.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      reorderTags.mutate(
        arrayMove(tags, oldIndex, newIndex).map((tag) => tag.id)
      )
    },
    [tags, reorderTags]
  )

  // 紐づく小計点グループは開いたタグの分だけ取得する
  const handleToggleSubtotalGroups = useCallback(
    async (tag: TagWithAllRelations) => {
      if (expandedTagId === tag.id) {
        setExpandedTagId(null)
        return
      }
      setExpandedTagId(tag.id)
    },
    [expandedTagId]
  )

  const handleCreate = () => {
    setModalTag(null)
    setShowModal(true)
  }

  const handleEdit = (tag: TagWithAllRelations) => {
    setModalTag(tag)
    setShowModal(true)
  }

  const handleConfirmDelete = () => {
    const tag = tagDeletion.target
    if (tag === null) return
    deleteTag.mutate(tag.id, {
      onSuccess: () => toast.success(`タグ「${tag.name}」を削除しました`),
    })
  }

  // 結合行はどれも onDelete: Cascade なので、付いている先すべてから外れる
  // （付いている先そのものは消えない）。どこから外れるかは利用先の内訳で示す
  const tagToDeleteUsage = tagDeletion.target
    ? formatTagUsage(tagDeletion.target)
    : null

  const handleSave = async (name: string, color: string | null) => {
    // 失敗はそのまま投げ返す（モーダルを閉じないため）。
    // 同じ名前は unique 制約で弾かれるので、そこだけ言い方を変える
    try {
      if (modalTag) {
        await updateTag.mutateAsync({ id: modalTag.id, data: { name, color } })
        toast.success(`タグ「${name}」を更新しました`)
        return
      }
      await createTag.mutateAsync({ name, color: color ?? undefined })
      toast.success(`タグ「${name}」を作成しました`)
    } catch (error) {
      if (error instanceof Error && error.message.includes("Unique")) {
        toast.error("同じ名前のタグが既に存在します")
      }
      throw error
    }
  }

  const toolbarActions: ToolbarAction[] = [
    toolbarButtonAction({
      id: "create",
      priority: 80,
      icon: PlusCircle,
      label: "新規タグ作成",
      onClick: handleCreate,
    }),
  ]

  return (
    <>
      {/* 閉じている間はマウントしない。開くたびに対象タグの値でフォームが作り直される */}
      {showModal && (
        <TagModal
          open={showModal}
          tag={modalTag}
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}

      <div className="flex h-full flex-col">
        <PageHeader
          title="タグ管理"
          subtitle={loading ? undefined : `${tags.length}件`}
          actions={toolbarActions}
        />

        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground">読み込み中...</p>
            </div>
          ) : tags.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Tag />
                </EmptyMedia>
                <EmptyTitle>タグがまだ作成されていません</EmptyTitle>
                <EmptyDescription>
                  教科名や試験種別などのタグを作成しましょう。
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <TooltipProvider delayDuration={300}>
              <div className="mx-auto max-w-xl space-y-2">
                <SortableTableProvider
                  items={tags.map((tag) => tag.id)}
                  onDragEnd={handleDragEnd}
                >
                  {tags.map((tag) => (
                    <SortableTagRow
                      key={tag.id}
                      tag={tag}
                      expanded={expandedTagId === tag.id}
                      linkedSubtotalGroups={
                        expandedTagId === tag.id ? linkedSubtotalGroups : null
                      }
                      onToggleSubtotalGroups={(tag) =>
                        void handleToggleSubtotalGroups(tag)
                      }
                      onEdit={handleEdit}
                      onDelete={tagDeletion.openWith}
                    />
                  ))}
                </SortableTableProvider>
              </div>
            </TooltipProvider>
          )}
        </div>
      </div>

      <AlertDialog
        open={tagDeletion.isOpen}
        onOpenChange={tagDeletion.handleOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              タグ「{tagDeletion.target?.name}」を削除しますか？
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tagToDeleteUsage === null || tagToDeleteUsage === "未使用"
                ? null
                : `付いている先（${tagToDeleteUsage}）からこのタグが外れます。試験や資料などそのものは消えません。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={handleConfirmDelete}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
