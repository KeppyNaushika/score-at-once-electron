"use client"

import type { Tag } from "@prisma/client"
import { Save } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

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
import { Textarea } from "@/components/ui/textarea"

interface EditCourseworkWindowProps {
  courseworkId: string
  initialName: string
  initialDescription: string
  /** yyyy-mm-dd 形式、未設定は空文字 */
  initialDate: string
  initialTagIds: string[]
  onClose: () => void
  onSaved: () => void
}

/**
 * 試験外成績資料の基本設定を編集するモーダル（試験の EditExamWindow 流儀）。
 * 名前・説明・実施日・タグを更新する。
 */
export function EditCourseworkWindow({
  courseworkId,
  initialName,
  initialDescription,
  initialDate,
  initialTagIds,
  onClose,
  onSaved,
}: EditCourseworkWindowProps) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [date, setDate] = useState(initialDate)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
    new Set(initialTagIds)
  )
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const loadTags = async () => {
      try {
        const tags = await window.electronAPI.tagGetAll()
        setAllTags(tags)
      } catch (error) {
        console.error("Failed to load tags:", error)
      }
    }
    void loadTags()
  }, [])

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev)
      if (next.has(tagId)) next.delete(tagId)
      else next.add(tagId)
      return next
    })
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const result = await window.electronAPI.coursework.update(courseworkId, {
        name: name.trim(),
        description: description.trim() || null,
        date: date || null,
      })
      if (!result.success) {
        toast.error("保存に失敗しました", { description: result.error })
        return
      }
      const tagResult = await window.electronAPI.coursework.setTags(
        courseworkId,
        [...selectedTagIds]
      )
      if (!tagResult.success) {
        toast.error("タグの保存に失敗しました", {
          description: tagResult.error,
        })
        return
      }
      onSaved()
      onClose()
    } catch (error) {
      console.error("Error saving coursework setup:", error)
      toast.error("保存に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>基本設定</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="coursework-name">資料名</Label>
            <Input
              id="coursework-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="coursework-description">説明（任意）</Label>
            <Textarea
              id="coursework-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="coursework-date">実施日（任意）</Label>
            <Input
              id="coursework-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-48"
            />
          </div>
          <div className="space-y-2">
            <Label>タグ（任意）</Label>
            {allTags.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                利用可能なタグがありません。タグ管理から作成してください。
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => {
                  const selected = selectedTagIds.has(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                    >
                      <Badge
                        variant={selected ? "default" : "outline"}
                        className="cursor-pointer"
                        style={
                          selected && tag.color
                            ? {
                                backgroundColor: tag.color,
                                borderColor: tag.color,
                              }
                            : undefined
                        }
                      >
                        {tag.name}
                      </Badge>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
