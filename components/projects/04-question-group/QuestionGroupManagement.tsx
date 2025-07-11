"use client"

import { QuestionGroupItemList } from "@/components/projects/04-question-group/QuestionGroupItemList"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { QuestionGroupWithItems } from "@/types/electron"
import { Edit, List, Plus, Settings, Trash2 } from "lucide-react"
import { useState } from "react"

interface QuestionGroupManagementProps {
  questionGroups: QuestionGroupWithItems[]
  selectedQuestionGroupId: string | null
  setSelectedQuestionGroupId: (id: string | null) => void
  onCreateQuestionGroup: (name: string) => Promise<boolean>
  onUpdateQuestionGroup: (id: string, name: string) => Promise<boolean>
  onDeleteQuestionGroup: (id: string) => Promise<boolean>
  onCreateQuestionGroupItem: (
    questionGroupId: string,
    name: string,
  ) => Promise<boolean>
  onUpdateQuestionGroupItem: (id: string, name: string) => Promise<boolean>
  onDeleteQuestionGroupItem: (id: string) => Promise<boolean>
  onUpdateQuestionGroupItemOrders: (
    orders: { id: string; order: number }[],
  ) => Promise<boolean>
}

export function QuestionGroupManagement({
  questionGroups,
  selectedQuestionGroupId,
  setSelectedQuestionGroupId,
  onCreateQuestionGroup,
  onUpdateQuestionGroup,
  onDeleteQuestionGroup,
  onCreateQuestionGroupItem,
  onUpdateQuestionGroupItem,
  onDeleteQuestionGroupItem,
  onUpdateQuestionGroupItemOrders,
}: QuestionGroupManagementProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [editingGroup, setEditingGroup] =
    useState<QuestionGroupWithItems | null>(null)
  const [editGroupName, setEditGroupName] = useState("")

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return

    const success = await onCreateQuestionGroup(newGroupName.trim())
    if (success) {
      setNewGroupName("")
      setShowCreateDialog(false)
    }
  }

  const handleEditGroup = async () => {
    if (!editingGroup || !editGroupName.trim()) return

    const success = await onUpdateQuestionGroup(
      editingGroup.id,
      editGroupName.trim(),
    )
    if (success) {
      setEditingGroup(null)
      setEditGroupName("")
      setShowEditDialog(false)
    }
  }

  const handleDeleteGroup = async (group: QuestionGroupWithItems) => {
    if (
      window.confirm(
        `小計点「${group.name}」を削除しますか？\n関連する項目と設問の関連付けも削除されます。`,
      )
    ) {
      await onDeleteQuestionGroup(group.id)
    }
  }

  const selectedGroup = questionGroups.find(
    (g) => g.id === selectedQuestionGroupId,
  )

  return (
    <div className="space-y-6">
      {/* 小計点一覧 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">小計点</h3>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                新しい小計点
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新しい小計点を作成</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="groupName">小計点名</Label>
                  <Input
                    id="groupName"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="例: 大問1, 読解, 計算問題"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                  >
                    キャンセル
                  </Button>
                  <Button onClick={handleCreateGroup}>作成</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {questionGroups.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center">
            <List className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>小計点がありません</p>
            <p className="text-sm">
              「新しい小計点」ボタンから作成してください
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {questionGroups.map((group) => (
              <Card
                key={group.id}
                className={`hover:bg-muted/50 cursor-pointer transition-colors ${
                  selectedQuestionGroupId === group.id
                    ? "ring-primary ring-2"
                    : ""
                }`}
                onClick={() => setSelectedQuestionGroupId(group.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{group.name}</CardTitle>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {group.items.length}項目
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingGroup(group)
                          setEditGroupName(group.name)
                          setShowEditDialog(true)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteGroup(group)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {group.items.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="text-muted-foreground text-sm"
                      >
                        • {item.name}
                      </div>
                    ))}
                    {group.items.length > 3 && (
                      <div className="text-muted-foreground text-sm">
                        ... 他{group.items.length - 3}項目
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 編集ダイアログ */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>小計点を編集</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editGroupName">小計点名</Label>
              <Input
                id="editGroupName"
                value={editGroupName}
                onChange={(e) => setEditGroupName(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowEditDialog(false)}
              >
                キャンセル
              </Button>
              <Button onClick={handleEditGroup}>更新</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 選択中の小計点の項目管理 */}
      {selectedGroup && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            <h3 className="text-lg font-semibold">
              「{selectedGroup.name}」の項目管理
            </h3>
          </div>
          <QuestionGroupItemList
            questionGroup={selectedGroup}
            onCreateItem={onCreateQuestionGroupItem}
            onUpdateItem={onUpdateQuestionGroupItem}
            onDeleteItem={onDeleteQuestionGroupItem}
            onUpdateItemOrders={onUpdateQuestionGroupItemOrders}
          />
        </div>
      )}
    </div>
  )
}
