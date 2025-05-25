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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>試験情報を編集</DialogTitle>
          <DialogDescription>
            試験の詳細情報を編集してください。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
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
                    className="group relative pr-8"
                  >
                    {editingTagId === tag.id ? (
                      <Input
                        type="text"
                        value={editingTagText}
                        onChange={(e) => setEditingTagText(e.target.value)}
                        onKeyDown={handleEditingTagInputKeyDown}
                        onBlur={() => {
                          /* 意図しない保存を防ぐため onBlur での保存は慎重に */
                        }}
                        className="h-6 px-1 text-xs"
                        autoFocus
                      />
                    ) : (
                      <span>{tag.text}</span>
                    )}
                    <div className="absolute top-1/2 right-1 flex -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                      {editingTagId === tag.id ? (
                        <CheckIcon
                          size={14}
                          className="mr-1 cursor-pointer text-green-600 hover:text-green-800"
                          onClick={handleSaveEditedTag}
                        />
                      ) : (
                        <Edit2Icon
                          size={14}
                          className="mr-1 cursor-pointer text-blue-600 hover:text-blue-800"
                          onClick={() => handleEditTag(tag)}
                        />
                      )}
                      <Trash2Icon
                        size={14}
                        className="cursor-pointer text-red-600 hover:text-red-800"
                        onClick={() => handleDeleteTagFromDb(tag.id)} // DBからタグ自体を削除
                        // onClick={() => handleRemoveTagFromProject(tag.id)} // プロジェクトからタグの関連を外すだけの場合
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
