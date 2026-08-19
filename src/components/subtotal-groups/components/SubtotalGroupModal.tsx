"use client"

import type { DragEndEvent } from "@dnd-kit/core"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useMutation, useQuery } from "@tanstack/react-query"
import { GripVertical, Plus, TagIcon, Trash2, XIcon } from "lucide-react"
import React, { useCallback, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { TagWithAllRelations } from "@/electron-src/lib/prisma/tag"
import {
  createSubtotalGroupMutation,
  type SubtotalGroupRow,
  updateSubtotalGroupMutation,
} from "@/queries/subtotal"
import {
  findOrCreateTagMutation,
  setSubtotalGroupTagsMutation,
  tagListQuery,
} from "@/queries/tag"

interface SubtotalGroupModalProps {
  isOpen: boolean
  onClose: () => void
  editingGroup: SubtotalGroupRow | null
}

interface SubtotalFormData {
  id: string
  name: string
  order: number
}

// ドラッグ可能な小計項目コンポーネント
function SortableSubtotalItem({
  subtotal,
  index,
  onUpdate,
  onDelete,
}: {
  subtotal: SubtotalFormData
  index: number
  onUpdate: (
    index: number,
    field: keyof SubtotalFormData,
    value: string | number
  ) => void
  onDelete: (index: number) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtotal.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border bg-background p-3"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab hover:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <Badge variant="outline" className="w-8 text-center">
        {index + 1}
      </Badge>
      <div className="flex-1">
        <Input
          placeholder="小計項目名"
          value={subtotal.name}
          onChange={(e) => onUpdate(index, "name", e.target.value)}
        />
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(index)}
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_TAGS: TagWithAllRelations[] = []

export function SubtotalGroupModal({
  isOpen,
  onClose,
  editingGroup,
}: SubtotalGroupModalProps) {
  // 呼び出し側（SubtotalGroupsPageContainer）は閉じている間このコンポーネントを
  // マウントしないため、開くたびに editingGroup の内容からフォームが始まる。
  const { data: allTags = EMPTY_TAGS } = useQuery(tagListQuery())
  const createSubtotalGroup = useMutation(createSubtotalGroupMutation())
  const updateSubtotalGroup = useMutation(updateSubtotalGroupMutation())
  const findOrCreateTag = useMutation(findOrCreateTagMutation())
  const setSubtotalGroupTags = useMutation(setSubtotalGroupTagsMutation())
  const [name, setName] = useState(editingGroup?.name ?? "")
  const [tagNames, setTagNames] = useState<string[]>(() =>
    (editingGroup?.tagSubtotalGroups ?? []).map(
      (tagSubtotalGroup) => tagSubtotalGroup.tag.name
    )
  )
  const [currentTagInput, setCurrentTagInput] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [subtotals, setSubtotals] = useState<SubtotalFormData[]>(() =>
    [...(editingGroup?.subtotals ?? [])]
      .sort((subtotalA, subtotalB) => subtotalA.order - subtotalB.order)
      .map((subtotal, index) => ({
        id: subtotal.id,
        name: subtotal.name,
        order: index,
      }))
  )
  const [saving, setSaving] = useState(false)
  /**
   * この開いている間に作ったグループの id。
   *
   * 作成のあとタグ側で失敗しても、次の「保存」で作り直さないために覚える。
   * `editingGroup` は props なので、作成直後は null のままである。
   */
  const [createdGroupId, setCreatedGroupId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 既存タグ一覧を取得（サジェスト用）
  const handleAddTag = useCallback(
    (tagName?: string) => {
      const nameToAdd = (tagName ?? currentTagInput).trim()
      if (nameToAdd && !tagNames.includes(nameToAdd)) {
        setTagNames([...tagNames, nameToAdd])
      }
      setCurrentTagInput("")
      setShowSuggestions(false)
    },
    [currentTagInput, tagNames]
  )

  const handleRemoveTag = (tagToRemove: string) => {
    setTagNames(tagNames.filter((tagName) => tagName !== tagToRemove))
  }

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleAddTag()
    }
  }

  // サジェスト候補
  const suggestions = allTags.filter(
    (tag) =>
      !tagNames.includes(tag.name) &&
      (currentTagInput.trim() === "" ||
        tag.name.toLowerCase().includes(currentTagInput.trim().toLowerCase()))
  )

  // 小計項目を追加
  const addSubtotal = () => {
    const newSubtotal: SubtotalFormData = {
      id: `temp-${Date.now()}`,
      name: "",
      order: subtotals.length,
    }
    setSubtotals([...subtotals, newSubtotal])
  }

  // 小計項目を更新
  const updateSubtotal = (
    index: number,
    field: keyof SubtotalFormData,
    value: string | number
  ) => {
    const updated = [...subtotals]
    updated[index] = { ...updated[index], [field]: value }
    setSubtotals(updated)
  }

  // 小計項目を削除
  const deleteSubtotal = (index: number) => {
    setSubtotals(subtotals.filter((_, i) => i !== index))
  }

  // ドラッグ終了時の処理
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return

    const activeIndex = subtotals.findIndex((item) => item.id === active.id)
    const overIndex = subtotals.findIndex((item) => item.id === over.id)

    if (activeIndex !== overIndex) {
      setSubtotals((items) => {
        const newItems = arrayMove(items, activeIndex, overIndex)
        // orderを更新
        return newItems.map((item, index) => ({ ...item, order: index }))
      })
    }
  }

  // 保存処理
  const handleSave = async () => {
    if (!name.trim()) {
      alert("グループ名を入力してください。")
      return
    }

    if (subtotals.length === 0) {
      alert("少なくとも1つの小計項目を追加してください。")
      return
    }

    const hasEmptyNames = subtotals.some((subtotal) => !subtotal.name.trim())
    if (hasEmptyNames) {
      alert("すべての小計項目に名前を入力してください。")
      return
    }

    setSaving(true)
    try {
      const groupData = {
        name: name.trim(),
        subtotals: subtotals.map((subtotal, index) => ({
          name: subtotal.name.trim(),
          order: index,
        })),
      }

      // **作った相手を覚える。** 作成のあとタグ側で失敗すると、モーダルは開いたまま
      // 入力を残すので利用者はもう一度「保存」を押す。覚えていないと作成の枝を
      // もう一度通り、**同名のグループがもう1つできて最初の1つはタグの付かないまま
      // 残る**（docs/branch-review-findings.md #14）。
      const existingGroupId = editingGroup?.id ?? createdGroupId
      const savedGroup = existingGroupId
        ? await updateSubtotalGroup.mutateAsync({
            subtotalGroupId: existingGroupId,
            data: groupData,
          })
        : await createSubtotalGroup.mutateAsync(groupData)
      setCreatedGroupId(savedGroup.id)

      // タグは他の紐付けと同じく、タグ名から findOrCreate して置換方式で保存する
      const tagIds: string[] = []
      for (const tagName of tagNames) {
        const tag = await findOrCreateTag.mutateAsync(tagName)
        tagIds.push(tag.id)
      }
      await setSubtotalGroupTags.mutateAsync({
        subtotalGroupId: savedGroup.id,
        tagIds,
      })

      onClose()
    } catch {
      // 失敗の知らせは中央のトーストが出す。ここでは閉じずに入力を残す
    } finally {
      setSaving(false)
    }
  }

  const totalItems = subtotals.length

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingGroup ? "小計点グループを編集" : "新しい小計点グループ"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 基本情報 */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="group-name">グループ名 *</Label>
              <Input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 国語小計、数学小計"
              />
            </div>
            <div>
              <Label htmlFor="subtotal-group-tags">タグ</Label>
              <div className="relative mt-2 mb-2 flex items-center gap-2">
                <Input
                  id="subtotal-group-tags"
                  value={currentTagInput}
                  onChange={(e) => {
                    setCurrentTagInput(e.target.value)
                    setShowSuggestions(true)
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => {
                    setTimeout(() => setShowSuggestions(false), 200)
                  }}
                  onKeyDown={handleTagInputKeyDown}
                  className="grow"
                  placeholder="教科名や試験種別などのタグを入力"
                />
                <Button
                  type="button"
                  onClick={() => handleAddTag()}
                  variant="outline"
                >
                  追加
                </Button>
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full right-10 left-0 z-50 mt-1 max-h-32 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                    {suggestions.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          handleAddTag(tag.name)
                        }}
                      >
                        <TagIcon className="h-3 w-3 opacity-50" />
                        {tag.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {tagNames.map((tagName) => (
                  <Badge key={tagName} variant="secondary">
                    {tagName}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tagName)}
                      className="ml-1.5 cursor-pointer appearance-none border-none bg-transparent p-0 text-secondary-foreground hover:text-destructive"
                      aria-label={`Remove ${tagName}`}
                    >
                      <XIcon size={14} />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* 小計項目 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">小計項目</Label>
                <div className="text-sm text-muted-foreground">
                  項目数: {totalItems}項目
                </div>
              </div>
              <Button onClick={addSubtotal} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                項目を追加
              </Button>
            </div>

            {subtotals.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed py-8 text-center text-muted-foreground">
                小計項目がありません。「項目を追加」ボタンで追加してください。
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={subtotals.map((subtotal) => subtotal.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {subtotals.map((subtotal, index) => (
                      <SortableSubtotalItem
                        key={subtotal.id}
                        subtotal={subtotal}
                        index={index}
                        onUpdate={updateSubtotal}
                        onDelete={deleteSubtotal}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
