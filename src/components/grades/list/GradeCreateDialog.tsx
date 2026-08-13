"use client"

import { useMutation } from "@tanstack/react-query"
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
import { createGradeMutation } from "@/queries/grade"

interface GradeCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: string) => void
}

export function GradeCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: GradeCreateDialogProps) {
  const [name, setName] = useState("")
  const createGrade = useMutation(createGradeMutation())

  const handleCreate = async () => {
    if (!name.trim()) return
    const grade = await createGrade.mutateAsync({ name: name.trim() })
    setName("")
    onCreated(grade.id)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>成績算出試験を作成</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">試験名</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 1学期末評定"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            評価項目（観点）は作成後に「データソース」ステップで追加できます
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || createGrade.isPending}
          >
            {createGrade.isPending ? "作成中..." : "作成"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
