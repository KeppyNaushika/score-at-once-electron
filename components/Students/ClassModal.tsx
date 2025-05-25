"use client"

import React, { useState, useEffect } from "react"
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
import { Prisma } from "@prisma/client"

type ClassWithStudents = Prisma.ClassGetPayload<{ include: { students: true } }>

interface ClassModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (classData: Omit<Prisma.ClassCreateInput, "id">) => void
  classToEdit: ClassWithStudents | null
}

export default function ClassModal({
  isOpen,
  onClose,
  onSave,
  classToEdit,
}: ClassModalProps) {
  const [name, setName] = useState("")
  const [grade, setGrade] = useState<number | undefined>(undefined)
  const [description, setDescription] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (classToEdit) {
      setName(classToEdit.name)
      setGrade(classToEdit.grade ?? undefined)
      setDescription(classToEdit.description ?? undefined)
    } else {
      setName("")
      setGrade(undefined)
      setDescription(undefined)
    }
  }, [classToEdit, isOpen])

  const handleSubmit = () => {
    if (!name.trim()) {
      alert("学級名は必須です。")
      return
    }
    onSave({
      name: name.trim(),
      grade: grade === undefined ? null : Number(grade), // Ensure grade is number or null
      description: description?.trim() || null,
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {classToEdit ? "学級情報を編集" : "新しい学級を作成"}
          </DialogTitle>
          <DialogDescription>
            学級の詳細情報を入力してください。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="className" className="text-right">
              学級名
            </Label>
            <Input
              id="className"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              placeholder="例: 1年A組"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="grade" className="text-right">
              学年
            </Label>
            <Input
              id="grade"
              type="number"
              value={grade === undefined ? "" : grade.toString()}
              onChange={(e) =>
                setGrade(
                  e.target.value === "" ? undefined : parseInt(e.target.value),
                )
              }
              className="col-span-3"
              placeholder="例: 1 (任意)"
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="classDescription" className="pt-2 text-right">
              説明
            </Label>
            <Input
              id="classDescription"
              value={description || ""}
              onChange={(e) => setDescription(e.target.value)}
              className="col-span-3"
              placeholder="学級の説明（任意）"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSubmit}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
