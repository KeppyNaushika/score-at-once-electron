"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, Tag } from "lucide-react"
import { QuestionGroupWithItems } from "../../../types/electron"

interface QuestionGroupItemListProps {
  questionGroup: QuestionGroupWithItems
  onCreateItem: (questionGroupId: string, name: string) => Promise<boolean>
  onUpdateItem: (id: string, name: string) => Promise<boolean>
  onDeleteItem: (id: string) => Promise<boolean>
}

export function QuestionGroupItemList({
  questionGroup,
  onCreateItem,
  onUpdateItem,
  onDeleteItem,
}: QuestionGroupItemListProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [newItemName, setNewItemName] = useState("")
  const [editingItem, setEditingItem] = useState<any>(null)
  const [editItemName, setEditItemName] = useState("")

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
    if (window.confirm(`項目「${item.name}」を削除しますか？\n関連する設問の関連付けも削除されます。`)) {
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
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
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
          <div className="text-center py-8 text-muted-foreground">
            <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>項目がありません</p>
            <p className="text-sm">「新しい項目」ボタンから作成してください</p>
          </div>
        ) : (
          <div className="space-y-3">
            {questionGroup.items.map((item, index) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">
                    {index + 1}
                  </Badge>
                  <span className="font-medium">{item.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingItem(item)
                      setEditItemName(item.name)
                      setShowEditDialog(true)
                    }}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteItem(item)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
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
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
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