"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { X as XIcon, Edit2Icon, CheckIcon, Trash2Icon } from "lucide-react"
import { Prisma, Tag } from "@prisma/client"

interface EditProjectWindowProps {
  projectToEdit: Prisma.ProjectGetPayload<{ include: { tags: true } }>
  setIsShowEditProjectWindow: (isOpen: boolean) => void
  onSave: (
    updatedProjectData: Prisma.ProjectGetPayload<{ include: { tags: true } }>,
  ) => Promise<void>
}

const EditProjectWindow = ({
  projectToEdit,
  setIsShowEditProjectWindow,
  onSave,
}: EditProjectWindowProps) => {
  const [examName, setExamName] = useState(projectToEdit.examName)
  const [examDate, setExamDate] = useState<Date | undefined>(
    projectToEdit.examDate ?? undefined,
  )
  const [description, setDescription] = useState<string | null>(
    projectToEdit.description ?? null,
  )
  const [tags, setTags] = useState<Tag[]>(projectToEdit.tags || [])
  const [currentTagInput, setCurrentTagInput] = useState("")
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [editingTagText, setEditingTagText] = useState<string>("")

  const handleSave = async () => {
    if (!examName.trim()) {
      alert("試験名は必須です。")
      return
    }
    const updatedProjectPayload: Prisma.ProjectGetPayload<{
      include: { tags: true }
    }> = {
      ...projectToEdit,
      examName: examName.trim(),
      examDate: examDate ?? null,
      description: description ?? null,
      tags: tags,
      updatedAt: new Date(),
    }
    await onSave(updatedProjectPayload)
  }

  const handleAddTag = async () => {
    if (
      currentTagInput.trim() &&
      !tags.find((tag) => tag.text === currentTagInput.trim())
    ) {
      try {
        const newTag = await window.electronAPI.createTag(
          currentTagInput.trim(),
        )
        if (newTag) {
          setTags([...tags, newTag])
        }
        setCurrentTagInput("")
      } catch (error) {
        console.error("Failed to create tag:", error)
        alert("タグの作成に失敗しました。")
      }
    }
  }

  const handleRemoveTagFromProject = (tagIdToRemove: string) => {
    setTags(tags.filter((tag) => tag.id !== tagIdToRemove))
  }

  const handleDeleteTagFromDb = async (tagIdToDelete: string) => {
    if (
      window.confirm(
        "このタグをデータベースから完全に削除しますか？関連する他のプロジェクトからも削除されます。",
      )
    ) {
      try {
        await window.electronAPI.deleteTag(tagIdToDelete)
        setTags(tags.filter((tag) => tag.id !== tagIdToDelete))
      } catch (error) {
        console.error("Failed to delete tag from DB:", error)
        alert("タグの削除に失敗しました。")
      }
    }
  }

  const handleEditTag = (tag: Tag) => {
    setEditingTagId(tag.id)
    setEditingTagText(tag.text)
  }

  const handleSaveEditedTag = async () => {
    if (!editingTagId || !editingTagText.trim()) return
    try {
      const updatedTag = await window.electronAPI.updateTag(
        editingTagId,
        editingTagText.trim(),
      )
      setTags(tags.map((tag) => (tag.id === editingTagId ? updatedTag : tag)))
      setEditingTagId(null)
      setEditingTagText("")
    } catch (error) {
      console.error("Failed to update tag:", error)
      alert("タグの更新に失敗しました。")
    }
  }

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddTag()
    }
  }

  const handleEditingTagInputKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleSaveEditedTag()
    }
    if (e.key === "Escape") {
      e.preventDefault()
      setEditingTagId(null)
      setEditingTagText("")
    }
  }

  return (
    <Dialog open onOpenChange={setIsShowEditProjectWindow}>
      <DialogContent className="sm:max-w-md">
        {" "}
        {/* sm:max-w-md に変更 */}
        <DialogHeader>
          <DialogTitle>試験情報を編集</DialogTitle>
          <DialogDescription>
            試験の詳細情報を編集してください。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          {" "}
          {/* gap-6 に変更 */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="examName" className="text-right">
              試験名
            </Label>
            <Input
              id="examName"
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              className="col-span-3"
              placeholder="例: 1学期期末試験"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="examDate" className="text-right">
              試験日
            </Label>
            <Input
              id="examDate"
              type="date"
              value={examDate ? examDate.toISOString().split("T")[0] : ""}
              onChange={(e) =>
                setExamDate(
                  e.target.value ? new Date(e.target.value) : undefined,
                )
              }
              className="col-span-3"
            />
          </div>
          {/* Description の編集機能がなかったので追加 */}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="edit-description" className="pt-2 text-right">
              説明
            </Label>
            <Textarea
              id="edit-description"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3 min-h-[80px]"
              placeholder="プロジェクトの説明（任意）"
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="tags" className="pt-2 text-right">
              科目
            </Label>
            <div className="col-span-3">
              <div className="mb-2 flex items-center gap-2">
                <Input
                  id="tags"
                  value={currentTagInput}
                  onChange={(e) => setCurrentTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  className="flex-grow"
                  placeholder="科目を入力してEnter"
                />
                <Button type="button" onClick={handleAddTag} variant="outline">
                  追加
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    className="group relative flex items-center pr-2" // pr-2 に変更し、items-center を追加
                  >
                    {editingTagId === tag.id ? (
                      <Input
                        type="text"
                        value={editingTagText}
                        onChange={(e) => setEditingTagText(e.target.value)}
                        onKeyDown={handleEditingTagInputKeyDown}
                        onBlur={() => {
                          // 編集中のタグからフォーカスが外れたら保存するか、キャンセルするか検討
                          // ここでは一旦何もしない (Enterキーでの保存を促す)
                          // もし自動保存したい場合は handleSaveEditedTag() を呼ぶ
                          // もしキャンセルしたい場合は setEditingTagId(null) を呼ぶ
                        }}
                        className="mr-1 h-6 flex-grow px-1 text-xs"
                        autoFocus
                      />
                    ) : (
                      <span className="mr-1">{tag.text}</span> // mr-1 を追加
                    )}
                    <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                      {" "}
                      {/* absolute を削除し、flex items-center を適用 */}
                      {editingTagId === tag.id ? (
                        <CheckIcon
                          size={16} // サイズを少し大きく
                          className="cursor-pointer text-green-600 hover:text-green-800"
                          onClick={handleSaveEditedTag}
                        />
                      ) : (
                        <Edit2Icon
                          size={16} // サイズを少し大きく
                          className="mr-1 cursor-pointer text-blue-600 hover:text-blue-800"
                          onClick={() => handleEditTag(tag)}
                        />
                      )}
                      {/* プロジェクトからタグを外すボタン (XIcon) を追加 */}
                      <XIcon
                        size={16} // サイズを少し大きく
                        className="ml-1 cursor-pointer text-gray-500 hover:text-gray-700"
                        onClick={() => handleRemoveTagFromProject(tag.id)}
                        title="このプロジェクトから科目を削除"
                      />
                      {/* DBからタグ自体を削除するボタン (TrashIcon) はより危険な操作なので、アイコンを分けるか、別の場所に配置することを検討 */}
                      <Trash2Icon
                        size={16} // サイズを少し大きく
                        className="ml-1 cursor-pointer text-red-600 hover:text-red-800"
                        onClick={() => handleDeleteTagFromDb(tag.id)}
                        title="データベースから科目を完全に削除"
                      />
                    </div>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsShowEditProjectWindow(false)}
          >
            キャンセル
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default EditProjectWindow
