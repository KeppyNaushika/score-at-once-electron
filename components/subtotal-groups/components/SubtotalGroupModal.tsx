"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, GripVertical } from "lucide-react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type {
  SubtotalGroup,
  SubtotalGroupFormData,
} from "@/components/subtotal-groups/types/subtotal-group-types"

interface SubtotalGroupModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  editingGroup: SubtotalGroup | null
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
      className="bg-background flex items-center gap-3 rounded-lg border p-3"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab hover:cursor-grabbing"
      >
        <GripVertical className="text-muted-foreground h-4 w-4" />
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

export function SubtotalGroupModal({
  isOpen,
  onClose,
  onSave,
  editingGroup,
}: SubtotalGroupModalProps) {
  const [formData, setFormData] = useState<SubtotalGroupFormData>({
    name: "",
    subtotals: [],
  })
  const [subtotals, setSubtotals] = useState<SubtotalFormData[]>([])
  const [saving, setSaving] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // フォームを初期化
  useEffect(() => {
    if (editingGroup) {
      setFormData({
        name: editingGroup.name,
        subtotals: [],
      })
      setSubtotals(
        editingGroup.subtotals
          .sort((a, b) => a.order - b.order)
          .map((s, index) => ({
            id: s.id,
            name: s.name,
            order: index,
          }))
      )
    } else {
      setFormData({
        name: "",
        subtotals: [],
      })
      setSubtotals([])
    }
  }, [editingGroup, isOpen])

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
    if (!formData.name.trim()) {
      alert("グループ名を入力してください。")
      return
    }

    if (subtotals.length === 0) {
      alert("少なくとも1つの小計項目を追加してください。")
      return
    }

    const hasEmptyNames = subtotals.some((s) => !s.name.trim())
    if (hasEmptyNames) {
      alert("すべての小計項目に名前を入力してください。")
      return
    }

    setSaving(true)
    try {
      const subtotalData = subtotals.map((s, index) => ({
        name: s.name.trim(),
        order: index,
      }))

      const groupData = {
        name: formData.name.trim(),
        subtotals: subtotalData,
      }

      let result
      if (editingGroup) {
        result = await window.electronAPI.updateSubtotalGroup(
          editingGroup.id,
          groupData
        )
      } else {
        result = await window.electronAPI.createSubtotalGroup(groupData)
      }

      if (result.success) {
        onSave()
        onClose()
      } else {
        alert("保存に失敗しました: " + result.error)
      }
    } catch (error) {
      console.error("Error saving subtotal group:", error)
      alert("保存中にエラーが発生しました。")
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
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="例: 国語小計、数学小計"
              />
            </div>
          </div>

          {/* 小計項目 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">小計項目</Label>
                <div className="text-muted-foreground text-sm">
                  項目数: {totalItems}項目
                </div>
              </div>
              <Button onClick={addSubtotal} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                項目を追加
              </Button>
            </div>

            {subtotals.length === 0 ? (
              <div className="text-muted-foreground rounded-lg border-2 border-dashed py-8 text-center">
                小計項目がありません。「項目を追加」ボタンで追加してください。
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={subtotals.map((s) => s.id)}
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
