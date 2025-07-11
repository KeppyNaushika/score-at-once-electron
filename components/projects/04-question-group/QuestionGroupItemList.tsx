"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Tag, GripVertical } from "lucide-react"
import { QuestionGroupWithItems } from "@/types/electron"
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
} from "@dnd-kit/sortable"
import {
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface QuestionGroupItemListProps {
  questionGroup: QuestionGroupWithItems
  onCreateItem: (questionGroupId: string, name: string) => Promise<boolean>
  onUpdateItem: (id: string, name: string) => Promise<boolean>
  onDeleteItem: (id: string) => Promise<boolean>
  onUpdateItemOrders: (orders: { id: string; order: number }[]) => Promise<boolean>
}

interface SortableItemProps {
  item: any
  index: number
  onEdit: (item: any) => void
  onDelete: (item: any) => void
}

function SortableItem({ item, index, onEdit, onDelete }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-muted/50 flex items-center justify-between rounded-lg p-3"
    >
      <div className="flex items-center gap-3">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-200"
        >
          <GripVertical className="h-4 w-4 text-gray-500" />
        </div>
        <Badge variant="outline" className="text-xs">
          {index + 1}
        </Badge>
        <span className="font-medium">{item.name}</span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(item)}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(item)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export function QuestionGroupItemList({
  questionGroup,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
  onUpdateItemOrders,
}: QuestionGroupItemListProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [newItemName, setNewItemName] = useState("")
  const [editingItem, setEditingItem] = useState<any>(null)
  const [editItemName, setEditItemName] = useState("")
  const [items, setItems] = useState(questionGroup.items)

  // Sync local items with props when questionGroup changes
  useEffect(() => {
    setItems(questionGroup.items)
  }, [questionGroup.items])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over?.id)

      const newItems = arrayMove(items, oldIndex, newIndex)
      setItems(newItems)

      // Create order updates
      const orderUpdates = newItems.map((item, index) => ({
        id: item.id,
        order: index,
      }))

      await onUpdateItemOrders(orderUpdates)
    }
  }

  const handleCreateItem = async () => {
    if (!newItemName.trim()) return

    const success = await onCreateItem(questionGroup.id, newItemName.trim())
    if (success) {
      setNewItemName("")
      setShowCreateDialog(false)
    }
  }

  const handleEditItem = async () => {
    if (!editingItem || !editItemName.trim()) return

    const success = await onUpdateItem(editingItem.id, editItemName.trim())
    if (success) {
      setEditingItem(null)
      setEditItemName("")
      setShowEditDialog(false)
    }
  }

  const handleDeleteItem = async (item: any) => {
    if (
      window.confirm(
        `項目「${item.name}」を削除しますか？\n関連する設問の関連付けも削除されます。`,
      )
    ) {
      await onDeleteItem(item.id)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            グループ項目
          </CardTitle>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                新しい項目
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新しい項目を作成</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="itemName">項目名</Label>
                  <Input
                    id="itemName"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="例: 問1, 問2, 知識・理解, 思考・判断"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                  >
                    キャンセル
                  </Button>
                  <Button onClick={handleCreateItem}>作成</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {questionGroup.items.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            <Tag className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>項目がありません</p>
            <p className="text-sm">「新しい項目」ボタンから作成してください</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={items} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {items.map((item, index) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    index={index}
                    onEdit={(item) => {
                      setEditingItem(item)
                      setEditItemName(item.name)
                      setShowEditDialog(true)
                    }}
                    onDelete={handleDeleteItem}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>

      {/* 編集ダイアログ */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>項目を編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editItemName">項目名</Label>
              <Input
                id="editItemName"
                value={editItemName}
                onChange={(e) => setEditItemName(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(false)}
              >
                キャンセル
              </Button>
              <Button onClick={handleEditItem}>更新</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
