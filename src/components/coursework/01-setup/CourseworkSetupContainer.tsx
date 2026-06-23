"use client"

import { Save } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { CourseworkWithDetails } from "@/types/coursework.types"

interface TagOption {
  id: string
  name: string
  color: string | null
}

interface CourseworkSetupContainerProps {
  courseworkId: string
}

/**
 * 試験外成績資料の基本設定コンテナ
 *
 * 名前・説明・実施日・タグを編集して保存する。タグは既存タグ一覧から
 * トグルで付与し、保存時に setTags で同期する。
 */
export function CourseworkSetupContainer({
  courseworkId,
}: CourseworkSetupContainerProps) {
  const router = useRouter()
  const [coursework, setCoursework] = useState<CourseworkWithDetails | null>(
    null
  )
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState("")
  const [allTags, setAllTags] = useState<TagOption[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [cwResult, tags] = await Promise.all([
        window.electronAPI.coursework.getById(courseworkId),
        window.electronAPI.tagGetAll(),
      ])

      setAllTags(tags.map((t) => ({ id: t.id, name: t.name, color: t.color })))

      if (cwResult.success && cwResult.coursework) {
        const cw = cwResult.coursework
        setCoursework(cw)
        setName(cw.name)
        setDescription(cw.description ?? "")
        setDate(cw.date ? new Date(cw.date).toISOString().split("T")[0] : "")
        setSelectedTagIds(new Set(cw.tags.map((t) => t.tagId)))
      }
    } catch (error) {
      console.error("Error loading coursework setup:", error)
    } finally {
      setLoading(false)
    }
  }, [courseworkId])

  useEffect(() => {
    loadData()
  }, [loadData])

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
      router.push(`/coursework/${courseworkId}/02-students`)
    } catch (error) {
      console.error("Error saving coursework setup:", error)
      toast.error("保存に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  if (!coursework) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">資料が見つかりません</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-6 text-lg font-semibold">基本設定</h2>
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">資料名</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">説明（任意）</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">実施日（任意）</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-48"
          />
        </div>

        <div className="space-y-2">
          <Label>タグ（任意）</Label>
          {allTags.length === 0 ? (
            <p className="text-muted-foreground text-xs">
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

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "保存中..." : "保存して次へ"}
          </Button>
        </div>
      </div>
    </div>
  )
}
