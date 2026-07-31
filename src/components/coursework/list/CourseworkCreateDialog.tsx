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

interface CourseworkCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => void
}

export function CourseworkCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: CourseworkCreateDialogProps) {
  const [name, setName] = useState("")
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!name.trim()) return

    setCreating(true)
    try {
      const result = await window.electronAPI.coursework.create({
        name: name.trim(),
      })
      if (result.success && result.coursework) {
        setName("")
        onCreated(result.coursework.id)
      }
    } catch (error) {
      console.error("Error creating coursework:", error)
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>試験外成績資料を作成</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">資料名</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 1学期 提出物・小テスト"
              onKeyDown={(e) =>
                e.key === "Enter" &&
                !e.nativeEvent.isComposing &&
                handleCreate()
              }
            />
          </div>
          <p className="text-xs text-muted-foreground">
            評価項目は作成後に「評価項目」ステップで追加できます
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
