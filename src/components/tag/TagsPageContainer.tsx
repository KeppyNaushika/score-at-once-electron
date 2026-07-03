"use client"

import type { DragEndEvent } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { Edit2, PlusCircle, Trash2, X as XIcon } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
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

interface TagItem {
  id: string
  name: string
  order: number
  color: string | null
}

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

// ---------------------------------------------------------------------------
// Sortable Tag Row
// ---------------------------------------------------------------------------

function SortableTagRow({
  tag,
  onEdit,
  onDelete,
}: {
  tag: TagItem
  onEdit: (tag: TagItem) => void
  onDelete: (tag: TagItem) => void
}) {
  const { setNodeRef, style, dragHandleProps } = useSortableRow(tag.id)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border-border bg-card flex items-center gap-3 rounded-lg border px-3 py-2"
    >
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
      <span className="min-w-0 flex-1 truncate font-medium">{tag.name}</span>
      <Badge
        variant="outline"
        className="text-xs font-normal"
        style={
          tag.color ? { borderColor: tag.color, color: tag.color } : undefined
        }
      >
        プレビュー
      </Badge>
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
        className="text-destructive hover:text-destructive h-7 w-7 p-0"
        onClick={() => onDelete(tag)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
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
  tag: TagItem | null
  onClose: () => void
  onSave: (name: string, color: string | null) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [color, setColor] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(tag?.name ?? "")
      setColor(tag?.color ?? null)
    }
  }, [open, tag])

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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{tag ? "タグを編集" : "新規タグ作成"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">タグ名</Label>
            <Input
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
              autoFocus
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

export function TagsPageContainer() {
  const [tags, setTags] = useState<TagItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modalTag, setModalTag] = useState<TagItem | null>(null)
  const [showModal, setShowModal] = useState(false)

  const loadTags = useCallback(async () => {
    try {
      const data = await window.electronAPI.tagGetAll()
      setTags(data)
    } catch {
      toast.error("タグの取得に失敗しました")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTags()
  }, [loadTags])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = tags.findIndex((tag) => tag.id === active.id)
      const newIndex = tags.findIndex((tag) => tag.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove(tags, oldIndex, newIndex)
      setTags(reordered)
      void window.electronAPI.tagReorder(reordered.map((tag) => tag.id))
    },
    [tags]
  )

  const handleCreate = () => {
    setModalTag(null)
    setShowModal(true)
  }

  const handleEdit = (tag: TagItem) => {
    setModalTag(tag)
    setShowModal(true)
  }

  const handleDelete = async (tag: TagItem) => {
    if (
      !window.confirm(
        `タグ「${tag.name}」を削除しますか？\n関連する全ての試験からこのタグが外れます。`
      )
    )
      return

    try {
      await window.electronAPI.tagDelete(tag.id)
      toast.success(`タグ「${tag.name}」を削除しました`)
      await loadTags()
    } catch {
      toast.error("タグの削除に失敗しました")
    }
  }

  const handleSave = async (name: string, color: string | null) => {
    try {
      if (modalTag) {
        await window.electronAPI.tagUpdate(modalTag.id, { name, color })
        toast.success(`タグ「${name}」を更新しました`)
      } else {
        await window.electronAPI.tagCreate({ name, color: color ?? undefined })
        toast.success(`タグ「${name}」を作成しました`)
      }
      await loadTags()
    } catch (error) {
      const msg =
        error instanceof Error && error.message.includes("Unique")
          ? "同じ名前のタグが既に存在します"
          : "タグの保存に失敗しました"
      toast.error(msg)
      throw error // モーダルを閉じない
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
      <TagModal
        open={showModal}
        tag={modalTag}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
      />

      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleCreate}>
              <PlusCircle className="mr-2 h-4 w-4" />
              新規タグ作成
            </Button>
            <span className="text-muted-foreground text-sm">
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
