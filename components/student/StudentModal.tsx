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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Prisma } from "@prisma/client"

type StudentWithClass = Prisma.StudentGetPayload<{ include: { memberships: { include: { class: true } } } }>
type ClassWithStudents = Prisma.ClassGetPayload<{ include: { memberships: true } }>

interface StudentModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (studentData: Prisma.StudentCreateInput) => void
  onUpdate: (id: string, studentData: Prisma.StudentUpdateInput) => void
  studentToEdit: StudentWithClass | null
  availableClasses: ClassWithStudents[]
}

export default function StudentModal({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  studentToEdit,
  availableClasses,
}: StudentModalProps) {
  const [studentId, setStudentId] = useState("")
  const [name, setName] = useState("")
  const [enrollmentYear, setEnrollmentYear] = useState<number | undefined>(undefined)
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    if (studentToEdit) {
      setStudentId(studentToEdit.studentId)
      setName(studentToEdit.name)
      setEnrollmentYear(studentToEdit.enrollmentYear ?? undefined)
    } else {
      setStudentId("")
      setName("")
      setEnrollmentYear(undefined)
    }
    setErrors({})
  }, [studentToEdit, isOpen])

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {}

    if (!studentId.trim()) {
      newErrors.studentId = "学籍番号は必須です。"
    }

    if (!name.trim()) {
      newErrors.name = "氏名は必須です。"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validateForm()) {
      return
    }

    const studentData = {
      studentId: studentId.trim(),
      name: name.trim(),
      enrollmentYear: enrollmentYear || undefined,
    }

    if (studentToEdit) {
      onUpdate(studentToEdit.id, studentData)
    } else {
      onSave(studentData)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {studentToEdit ? "生徒情報を編集" : "新しい生徒を追加"}
          </DialogTitle>
          <DialogDescription>
            生徒の詳細情報を入力してください。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="studentId" className="text-right">
              学籍番号
            </Label>
            <div className="col-span-3">
              <Input
                id="studentId"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="例: 202401001"
                autoFocus
              />
              {errors.studentId && (
                <p className="mt-1 text-sm text-red-500">{errors.studentId}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              氏名
            </Label>
            <div className="col-span-3">
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 山田太郎"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-500">{errors.name}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="enrollmentYear" className="text-right">
              入学年度
            </Label>
            <div className="col-span-3">
              <Input
                id="enrollmentYear"
                type="number"
                value={enrollmentYear === undefined ? "" : enrollmentYear.toString()}
                onChange={(e) =>
                  setEnrollmentYear(
                    e.target.value === "" ? undefined : parseInt(e.target.value),
                  )
                }
                placeholder="例: 2024 (任意)"
                min="2000"
                max="2050"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                学級所属は別途「所属追加」ボタンから設定してください
              </p>
            </div>
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