"use client"

import { Save } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { GradeWithRelations } from "@/types/grade.types"

interface SetupContainerProps {
  gradeId: string
}

export function SetupContainer({ gradeId }: SetupContainerProps) {
  const router = useRouter()
  const [exam, setExam] = useState<GradeWithRelations | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [referenceDate, setReferenceDate] = useState("")
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const gradeResult = await window.electronAPI.grade.getById(gradeId)

      if (gradeResult.success && gradeResult.grade) {
        const grade = gradeResult.grade
        setExam(grade)
        setName(grade.name)
        setDescription(grade.description ?? "")
        setReferenceDate(
          grade.referenceDate
            ? new Date(grade.referenceDate).toISOString().split("T")[0]
            : ""
        )
      }
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
    }
  }, [gradeId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const result = await window.electronAPI.grade.update(gradeId, {
        name: name.trim(),
        description: description.trim() || undefined,
        referenceDate: referenceDate || null,
      })
      if (result.success) {
        router.push(`/grades/${gradeId}/02-students`)
      }
    } catch (error) {
      console.error("Error saving:", error)
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

  if (!exam) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">試験が見つかりません</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-6 text-lg font-semibold">基本設定</h2>
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">試験名</Label>
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
          <Label htmlFor="referenceDate">成績算出基準日（任意）</Label>
          <Input
            id="referenceDate"
            type="date"
            value={referenceDate}
            onChange={(e) => setReferenceDate(e.target.value)}
            className="w-48"
          />
          <p className="text-muted-foreground text-xs">
            学級から生徒を追加する際、この日付時点で在籍中の生徒が対象になります。未設定の場合は本日が基準になります。
          </p>
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
