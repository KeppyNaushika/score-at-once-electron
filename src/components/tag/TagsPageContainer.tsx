"use client"

import type { DragEndEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { useMutation, useQuery } from "@tanstack/react-query"
import { Calculator, Edit2, PlusCircle, Trash2, XIcon } from "lucide-react"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import { DragHandle } from "@/components/common/sortable-table/DragHandle"
import { SortableTableProvider } from "@/components/common/sortable-table/SortableTableProvider"
import { useSortableRow } from "@/components/common/sortable-table/useSortableRow"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ColorPicker } from "@/components/ui/color-picker"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { TagWithAllRelations } from "@/electron-src/lib/prisma/tag"
import type { TagSubtotalGroupWithSubtotalGroup } from "@/electron-src/lib/prisma/tagSubtotalGroup"
import { useDialogAutoFocus } from "@/hooks/useDialogAutoFocus"
import {
  createTagMutation,
  deleteTagMutation,
  reorderTagsMutation,
  tagListQuery,
  tagSubtotalGroupsQuery,
  updateTagMutation,
} from "@/queries/tag"

const TAG_COLOR_PRESETS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#6b7280", // gray
]

/**
 * タグの利用先内訳を1行の文言にする。
 * タグ自体は用途を持たず、何を分類するタグかは付いた先で決まるため、それを可視化する。
 */
function formatTagUsage(tag: TagWithAllRelations): string {
  const usages = [
    { label: "試験", links: tag.examTags },
    { label: "資料", links: tag.courseworkTags },
    { label: "解答用紙定義", links: tag.asbDefinitionTags },
    { label: "小計点グループ", links: tag.tagSubtotalGroups },
  ]
    .filter((usage) => usage.links.length > 0)
    .map((usage) => `${usage.label} ${usage.links.length}`)

  return usages.length > 0 ? usages.join(" / ") : "未使用"
}

// ---------------------------------------------------------------------------
// Sortable Tag Row
// ---------------------------------------------------------------------------

function SortableTagRow({
  tag,
  expanded,
  linkedSubtotalGroups,
  onToggleSubtotalGroups,
  onEdit,
  onDelete,
}: {
  tag: TagWithAllRelations
  expanded: boolean
  /** 展開中タグの紐付け。読み込み中は null */
  linkedSubtotalGroups: TagSubtotalGroupWithSubtotalGroup[] | null
  onToggleSubtotalGroups: (tag: TagWithAllRelations) => void
  onEdit: (tag: TagWithAllRelations) => void
  onDelete: (tag: TagWithAllRelations) => void
}) {
  const { setNodeRef, style, dragHandleProps } = useSortableRow(tag.id)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-border bg-card"
    >
      <div className="flex items-center gap-3 px-3 py-2">
        <DragHandle dragHandleProps={dragHandleProps} />
        {tag.color && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="h-4 w-4 shrink-0 cursor-pointer rounded-full border transition-transform hover:scale-125"
                style={{ backgroundColor: tag.color }}
                onClick={() => onEdit(tag)}
              />
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={5}>
              クリックして色を変更
            </TooltipContent>
          </Tooltip>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{tag.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {formatTagUsage(tag)}
          </div>
        </div>
        <Badge
          variant="outline"
          className="text-xs font-normal"
          style={
            tag.color ? { borderColor: tag.color, color: tag.color } : undefined
          }
        >
          プレビュー
        </Badge>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 w-7 p-0 ${expanded ? "text-primary" : ""}`}
              onClick={() => onToggleSubtotalGroups(tag)}
            >
              <Calculator className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={5}>
            紐づく小計点グループを表示
          </TooltipContent>
        </Tooltip>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onEdit(tag)}
        >
          <Edit2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          onClick={() => onDelete(tag)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      {expanded && (
        <div className="border-t px-3 py-2">
          {linkedSubtotalGroups === null ? (
            <p className="text-xs text-muted-foreground">読み込み中...</p>
          ) : linkedSubtotalGroups.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              このタグが付いた小計点グループはありません。小計点グループ画面で付けられます。
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 text-xs text-muted-foreground">
                小計点グループ
              </span>
              {linkedSubtotalGroups.map((tagSubtotalGroup) => (
                <Badge
                  key={tagSubtotalGroup.subtotalGroup.id}
                  variant="secondary"
                  className="text-xs font-normal"
                >
                  {tagSubtotalGroup.subtotalGroup.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tag Modal (Create / Edit)
// ---------------------------------------------------------------------------

function TagModal({
  open,
  tag,
  onClose,
  onSave,
}: {
  open: boolean
  tag: TagWithAllRelations | null
  onClose: () => void
  onSave: (name: string, color: string | null) => Promise<void>
}) {
  // 呼び出し側は閉じている間このコンポーネントをマウントしないため、
  // 開くたびに対象タグの値からフォームが始まる。
  const [name, setName] = useState(tag?.name ?? "")
  const [color, setColor] = useState<string | null>(tag?.color ?? null)
  const { inputRef: nameInputRef, onOpenAutoFocus } = useDialogAutoFocus(open)

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("タグ名を入力してください")
      return
    }
    await onSave(name.trim(), color)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm" onOpenAutoFocus={onOpenAutoFocus}>
        <DialogHeader>
          <DialogTitle>{tag ? "タグを編集" : "新規タグ作成"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">タグ名</Label>
            <Input
              ref={nameInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  void handleSave()
                }
              }}
              className="col-span-3"
              placeholder="例: 数学"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">色</Label>
            <div className="col-span-3 flex items-center gap-2">
              {color ? (
                <>
                  <ColorPicker
                    value={color}
                    onChange={setColor}
                    presets={TAG_COLOR_PRESETS}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setColor(null)}
                  >
                    <XIcon className="mr-1 h-3 w-3" />
                    色なし
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setColor(TAG_COLOR_PRESETS[5])}
                >
                  色を設定
                </Button>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={() => void handleSave()}>
            {tag ? "保存" : "作成"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Main Container
// ---------------------------------------------------------------------------

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

  const handleDelete = async (tag: TagWithAllRelations) => {
    if (
      !window.confirm(
        `タグ「${tag.name}」を削除しますか？\n関連する全ての試験からこのタグが外れます。`
      )
    )
      return

    deleteTag.mutate(tag.id, {
      onSuccess: () => toast.success(`タグ「${tag.name}」を削除しました`),
    })
  }

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

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

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
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCreate}>
              <PlusCircle className="mr-2 h-4 w-4" />
              新規タグ作成
            </Button>
            <span className="text-sm text-muted-foreground">
              {tags.length}件
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {tags.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-muted-foreground">
                タグがまだ作成されていません。教科名や試験種別などのタグを作成しましょう。
              </p>
            </div>
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
                      onDelete={(tag) => void handleDelete(tag)}
                    />
                  ))}
                </SortableTableProvider>
              </div>
            </TooltipProvider>
          )}
        </div>
      </div>
    </>
  )
}
