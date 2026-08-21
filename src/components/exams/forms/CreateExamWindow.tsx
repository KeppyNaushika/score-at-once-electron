"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { TagIcon, XIcon } from "lucide-react"
import React, { useCallback, useRef, useState } from "react"

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
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import type { TagWithAllRelations } from "@/electron-src/lib/prisma/tag"
import { useDialogAutoFocus } from "@/hooks/useDialogAutoFocus"
import { createExamMutation } from "@/queries/exam"
import {
  findOrCreateTagMutation,
  setExamTagsForNewExamMutation,
  tagListQuery,
} from "@/queries/tag"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_TAGS: TagWithAllRelations[] = []

interface CreateExamWindowProps {
  onClose: () => void
  onExamCreated?: () => void
}

const CreateExamWindow: React.FC<CreateExamWindowProps> = ({
  onClose,
  onExamCreated,
}) => {
  const { data: allTags = EMPTY_TAGS } = useQuery(tagListQuery())
  const [examName, setExamName] = useState("")
  const [examDate, setExamDate] = useState<Date | null>(null)
  const [description, setDescription] = useState("")
  const [tagTexts, setTagTexts] = useState<string[]>([])
  /**
   * この窓で作った試験。タグ側で失敗したあとの再試行で、作り直さないために覚える。
   * 描画に使わないので ref（state にすると保存のたびに描き直される）。
   */
  const createdExamRef = useRef<Awaited<
    ReturnType<typeof createExam.mutateAsync>
  > | null>(null)
  const [currentTagInput, setCurrentTagInput] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  // このコンポーネントは親が条件付きでマウントする＝常に開いた状態
  const { inputRef: examNameInputRef, onOpenAutoFocus } =
    useDialogAutoFocus(true)
  const currentUser = useCurrentUser()
  const createExam = useMutation(createExamMutation(currentUser.id))
  const findOrCreateTag = useMutation(findOrCreateTagMutation())
  const setExamTags = useMutation(setExamTagsForNewExamMutation())

  // 既存タグを取得
  const handleSubmit = async () => {
    if (!examName.trim()) {
      alert("試験名は必須です。")
      return
    }
    try {
      // **作った試験を覚える。** タグ側で失敗しても閉じずに入力を残すので、
      // 覚えていないと次の「保存」で**同じ試験がもう1つできる**
      // （docs/branch-review-findings.md #14 と同じ形）
      const createdExam =
        createdExamRef.current ??
        (await createExam.mutateAsync({
          examName: examName.trim(),
          examDate: examDate,
          description: description.trim() || undefined,
        }))
      createdExamRef.current = createdExam

      // タグを保存
      if (tagTexts.length > 0 && createdExam?.id) {
        const tagIds: string[] = []
        for (const tagName of tagTexts) {
          const tag = await findOrCreateTag.mutateAsync(tagName)
          tagIds.push(tag.id)
        }
        await setExamTags.mutateAsync({
          examId: createdExam.id,
          tagIds,
        })
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
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={onOpenAutoFocus}>
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
              ref={examNameInputRef}
              value={examName}
              onChange={(e) => setExamName(e.target.value)}
              className="col-span-3"
              placeholder="例: 2学期中間試験"
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
                {tagTexts.map((tagText, index) => (
                  <Badge key={index} variant="secondary">
                    {tagText}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tagText)}
                      className="ml-1.5 cursor-pointer appearance-none border-none bg-transparent p-0 text-secondary-foreground hover:text-destructive"
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
