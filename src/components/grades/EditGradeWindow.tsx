"use client"

import { Save } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

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

interface EditGradeWindowProps {
  gradeId: string
  initialName: string
  initialDescription: string
  /** yyyy-mm-dd 形式、未設定は空文字 */
  initialReferenceDate: string
  onClose: () => void
  onSaved: () => void
}

/**
 * 成績算出の基本設定を編集するモーダル（試験の EditExamWindow 流儀）。
 * 名前・説明・基準日を更新する。
 */
export function EditGradeWindow({
  gradeId,
  initialName,
  initialDescription,
  initialReferenceDate,
  onClose,
  onSaved,
}: EditGradeWindowProps) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [referenceDate, setReferenceDate] = useState(initialReferenceDate)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await window.electronAPI.grade.update(gradeId, {
        name: name.trim(),
        description: description.trim() || null,
        referenceDate: referenceDate || null,
      })
      onSaved()
      onClose()
    } catch (error) {
      console.error("Error saving grade setup:", error)
      toast.error("保存に失敗しました", {
        description: error instanceof Error ? error.message : undefined,
      })
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
            <Label htmlFor="grade-name">試験名</Label>
            <Input
              id="grade-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="grade-description">説明（任意）</Label>
            <Textarea
              id="grade-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="grade-reference-date">成績算出基準日（任意）</Label>
            <Input
              id="grade-reference-date"
              type="date"
              value={referenceDate}
              onChange={(e) => setReferenceDate(e.target.value)}
              className="w-48"
            />
            <p className="text-xs text-muted-foreground">
              学級から生徒を追加する際、この日付時点で在籍中の生徒が対象になります。未設定の場合は本日が基準になります。
            </p>
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
