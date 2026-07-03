"use client"

import { Tag as TagIcon, X as XIcon } from "lucide-react"
import React, { useCallback, useEffect, useState } from "react"

import { useExams } from "@/components/hooks/useExams"
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

interface CreateExamWindowProps {
  onClose: () => void
  onExamCreated?: () => void
}

const CreateExamWindow: React.FC<CreateExamWindowProps> = ({
  onClose,
  onExamCreated,
}) => {
  const [examName, setExamName] = useState("")
  const [examDate, setExamDate] = useState<Date | null>(null)
  const [description, setDescription] = useState("")
  const [tagTexts, setTagTexts] = useState<string[]>([])
  const [currentTagInput, setCurrentTagInput] = useState("")
  const [allTags, setAllTags] = useState<{ id: string; name: string }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const { createExam } = useExams()

  // 既存タグを取得
  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await window.electronAPI.tagGetAll()
        setAllTags(tags)
      } catch {
        // ignore
      }
    }
    void loadTags()
  }, [])

  const handleSubmit = async () => {
    if (!examName.trim()) {
      alert("試験名は必須です。")
      return
    }
    try {
      const createdExam = await createExam({
        examName: examName.trim(),
        examDate: examDate,
        description: description.trim() || undefined,
      })

      // タグを保存
      if (tagTexts.length > 0 && createdExam?.id) {
        const tagIds: string[] = []
        for (const tagName of tagTexts) {
          const tag = await window.electronAPI.tagFindOrCreate(tagName)
          tagIds.push(tag.id)
        }
        await window.electronAPI.examTagSetExamTags(createdExam.id, tagIds)
      }

      onExamCreated?.()
      onClose()
    } catch (error) {
      console.error("Failed to create exam:", error)
    }
  }

  const handleAddTag = useCallback(
    (tagName?: string) => {
      const name = (tagName ?? currentTagInput).trim()
      if (name && !tagTexts.includes(name)) {
        setTagTexts([...tagTexts, name])
      }
      setCurrentTagInput("")
      setShowSuggestions(false)
    },
    [currentTagInput, tagTexts]
  )

  const handleRemoveTag = (tagToRemove: string) => {
    setTagTexts(tagTexts.filter((tag) => tag !== tagToRemove))
  }

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleAddTag()
    }
  }

  // サジェスト候補（入力中のテキストでフィルタ、既に追加済みは除外）
  const suggestions = allTags.filter(
    (tag) =>
      !tagTexts.includes(tag.name) &&
      (currentTagInput.trim() === "" ||
        tag.name.toLowerCase().includes(currentTagInput.trim().toLowerCase()))
  )

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新規試験作成</DialogTitle>
          <DialogDescription>
            新しい試験の詳細情報を入力してください。
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
              placeholder="例: 2学期中間試験"
              autoFocus
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
                setExamDate(e.target.value ? new Date(e.target.value) : null)
              }
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="description" className="pt-2 text-right">
              説明
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3 min-h-20"
              placeholder="試験の説明（任意）"
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="tagTexts" className="pt-2 text-right">
              タグ
            </Label>
            <div className="col-span-3">
              <div className="relative mb-2 flex items-center gap-2">
                <Input
                  id="tagTexts"
                  value={currentTagInput}
                  onChange={(e) => {
                    setCurrentTagInput(e.target.value)
                    setShowSuggestions(true)
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => {
                    // blurを少し遅延させてクリックイベントを拾えるようにする
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
                {tagTexts.map((tagText, index) => (
                  <Badge key={index} variant="secondary">
                    {tagText}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tagText)}
                      className="text-secondary-foreground hover:text-destructive ml-1.5 cursor-pointer appearance-none border-none bg-transparent p-0"
                      aria-label={`Remove ${tagText}`}
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
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit}>作成</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default CreateExamWindow
