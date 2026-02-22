"use client"

import { useState } from "react"

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

interface GradeProjectCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => void
}

export function GradeProjectCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: GradeProjectCreateDialogProps) {
  const [name, setName] = useState("")
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return

    setCreating(true)
    try {
      const result = await window.electronAPI.gradeProject.create({
        name: name.trim(),
      })
      if (result.success && result.gradeProject) {
        setName("")
        onCreated(result.gradeProject.id)
      }
    } catch (error) {
      console.error("Error creating grade project:", error)
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>成績算出プロジェクトを作成</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">プロジェクト名</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 1学期末評定"
            />
          </div>
          <p className="text-muted-foreground text-xs">
            評価項目（観点）は作成後に「データソース」ステップで追加できます
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || creating}>
            {creating ? "作成中..." : "作成"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
