"use client"

import type { Exam } from "@prisma/client"
import { Tag as TagIcon, X as XIcon } from "lucide-react"
import React, { useCallback, useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
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

interface EditExamWindowProps {
  examToEdit: Exam
  setIsShowEditExamWindow: (isOpen: boolean) => void
  onSave: (updatedExamData: Exam) => Promise<void>
}

const EditExamWindow = ({
  examToEdit,
  setIsShowEditExamWindow,
  onSave,
}: EditExamWindowProps) => {
  const [examName, setExamName] = useState(examToEdit.examName)
  const [examDate, setExamDate] = useState<Date | undefined>(() => {
    if (!examToEdit.examDate) return undefined
    return examToEdit.examDate instanceof Date
      ? examToEdit.examDate
      : new Date(examToEdit.examDate)
  })
  const [description, setDescription] = useState<string | null>(
    examToEdit.description ?? null
  )
  const [tagNames, setTagNames] = useState<string[]>([])
  const [currentTagInput, setCurrentTagInput] = useState("")
  const [allTags, setAllTags] = useState<{ id: string; name: string }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  // 既存タグと全タグ一覧を取得
  useEffect(() => {
    const loadTags = async () => {
      try {
        const [examTags, tags] = await Promise.all([
          window.electronAPI.examTagGetByExamId(examToEdit.id),
          window.electronAPI.tagGetAll(),
        ])
        setTagNames(examTags.map((examTag) => examTag.tag.name))
        setAllTags(tags)
      } catch {
        // ignore
      }
    }
    void loadTags()
  }, [examToEdit.id])

  const handleSave = async () => {
    if (!examName.trim()) {
      alert("試験名は必須です。")
      return
    }

    // タグを保存
    try {
      const tagIds: string[] = []
      for (const name of tagNames) {
        const tag = await window.electronAPI.tagFindOrCreate(name)
        tagIds.push(tag.id)
      }
      await window.electronAPI.examTagSetExamTags(examToEdit.id, tagIds)
    } catch (error) {
      console.error("Failed to save tags:", error)
    }

    const updatedExamPayload: Exam = {
      ...examToEdit,
      examName: examName.trim(),
      examDate: examDate ?? null,
      description: description ?? null,
      updatedAt: new Date(),
    }
    await onSave(updatedExamPayload)
  }

  const handleAddTag = useCallback(
    (tagName?: string) => {
      const name = (tagName ?? currentTagInput).trim()
      if (name && !tagNames.includes(name)) {
        setTagNames([...tagNames, name])
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

  return (
    <Dialog open onOpenChange={setIsShowEditExamWindow}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>試験情報を編集</DialogTitle>
          <DialogDescription>
            試験の詳細情報を編集してください。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
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
                  e.target.value ? new Date(e.target.value) : undefined
                )
              }
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="edit-description" className="pt-2 text-right">
              説明
            </Label>
            <Textarea
              id="edit-description"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3 min-h-20"
              placeholder="試験の説明（任意）"
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="tags" className="pt-2 text-right">
              タグ
            </Label>
            <div className="col-span-3">
              <div className="relative mb-2 flex items-center gap-2">
                <Input
                  id="tags"
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
                  <div className="bg-popover border-border absolute top-full right-10 left-0 z-50 mt-1 max-h-32 overflow-y-auto rounded-md border shadow-md">
                    {suggestions.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        className="hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm"
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
                {tagNames.map((name, index) => (
                  <Badge key={index} variant="secondary">
                    {name}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(name)}
                      className="text-secondary-foreground hover:text-destructive ml-1.5 cursor-pointer appearance-none border-none bg-transparent p-0"
                      aria-label={`Remove ${name}`}
                    >
                      <XIcon size={14} />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsShowEditExamWindow(false)}
          >
            キャンセル
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default EditExamWindow
