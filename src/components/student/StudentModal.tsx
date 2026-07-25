"use client"

import type { Prisma } from "@prisma/client"
import { useEffect, useState } from "react"

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
import { useDialogAutoFocus } from "@/hooks/useDialogAutoFocus"

// StudentModalに必要な最小限のフィールド（createdAt/updatedAtは不要）
interface StudentForEdit {
  id: string
  studentNumber: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  enrollmentYear?: number | null
}

interface StudentModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (studentData: Prisma.StudentCreateInput) => void
  onUpdate: (id: string, studentData: Prisma.StudentUpdateInput) => void
  studentToEdit: StudentForEdit | null
}

export default function StudentModal({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  studentToEdit,
}: StudentModalProps) {
  const [studentId, setStudentId] = useState("")
  const [lastName, setLastName] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastNameKana, setLastNameKana] = useState("")
  const [firstNameKana, setFirstNameKana] = useState("")
  const [enrollmentYear, setEnrollmentYear] = useState<number | undefined>(
    undefined
  )
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const { inputRef: studentIdInputRef, onOpenAutoFocus } =
    useDialogAutoFocus(isOpen)

  useEffect(() => {
    let canceled = false
    const frame = requestAnimationFrame(() => {
      if (canceled) {
        return
      }

      if (studentToEdit) {
        setStudentId(studentToEdit.studentNumber)
        setLastName(studentToEdit.lastName)
        setFirstName(studentToEdit.firstName)
        setLastNameKana(studentToEdit.lastNameKana)
        setFirstNameKana(studentToEdit.firstNameKana)
        setEnrollmentYear(studentToEdit.enrollmentYear ?? undefined)
      } else {
        setStudentId("")
        setLastName("")
        setFirstName("")
        setLastNameKana("")
        setFirstNameKana("")
        setEnrollmentYear(undefined)
      }
      setErrors({})
    })

    return () => {
      canceled = true
      cancelAnimationFrame(frame)
    }
  }, [studentToEdit, isOpen])

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {}

    if (!studentId.trim()) {
      newErrors.studentId = "学籍番号は必須です。"
    }

    if (!lastName.trim()) {
      newErrors.lastName = "姓は必須です。"
    }

    if (!firstName.trim()) {
      newErrors.firstName = "名は必須です。"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validateForm()) {
      return
    }

    const studentData = {
      studentNumber: studentId.trim(),
      lastName: lastName.trim(),
      firstName: firstName.trim(),
      lastNameKana: lastNameKana.trim(),
      firstNameKana: firstNameKana.trim(),
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
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={onOpenAutoFocus}>
        <DialogHeader>
          <DialogTitle>
            {studentToEdit ? "生徒情報を編集" : "新しい生徒を追加"}
          </DialogTitle>
          <DialogDescription>
            生徒の詳細情報を入力してください。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 py-4">
          <div className="grid grid-cols-4 items-center gap-x-4 gap-y-1">
            <Label
              htmlFor="studentId"
              className="text-muted-foreground text-right font-normal"
            >
              学籍番号
            </Label>
            <div className="col-span-3">
              <Input
                id="studentId"
                ref={studentIdInputRef}
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="例: 202401001"
              />
              {errors.studentId && (
                <p className="mt-1 text-sm text-red-500">{errors.studentId}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-x-4 gap-y-1">
            <Label
              htmlFor="lastName"
              className="text-muted-foreground text-right font-normal"
            >
              姓
            </Label>
            <div className="col-span-3">
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="例: 山田"
              />
              {errors.lastName && (
                <p className="mt-1 text-sm text-red-500">{errors.lastName}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-x-4 gap-y-1">
            <Label
              htmlFor="firstName"
              className="text-muted-foreground text-right font-normal"
            >
              名
            </Label>
            <div className="col-span-3">
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="例: 太郎"
              />
              {errors.firstName && (
                <p className="mt-1 text-sm text-red-500">{errors.firstName}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-x-4 gap-y-1">
            <Label
              htmlFor="lastNameKana"
              className="text-muted-foreground text-right font-normal"
            >
              姓カナ
            </Label>
            <div className="col-span-3">
              <Input
                id="lastNameKana"
                value={lastNameKana}
                onChange={(e) => setLastNameKana(e.target.value)}
                placeholder="例: ヤマダ"
              />
              {errors.lastNameKana && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.lastNameKana}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-x-4 gap-y-1">
            <Label
              htmlFor="firstNameKana"
              className="text-muted-foreground text-right font-normal"
            >
              名カナ
            </Label>
            <div className="col-span-3">
              <Input
                id="firstNameKana"
                value={firstNameKana}
                onChange={(e) => setFirstNameKana(e.target.value)}
                placeholder="例: タロウ"
              />
              {errors.firstNameKana && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.firstNameKana}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-x-4 gap-y-1">
            <Label
              htmlFor="enrollmentYear"
              className="text-muted-foreground text-right font-normal"
            >
              入学年度
            </Label>
            <div className="col-span-3">
              <Input
                id="enrollmentYear"
                type="number"
                value={
                  enrollmentYear === undefined ? "" : enrollmentYear.toString()
                }
                onChange={(e) =>
                  setEnrollmentYear(
                    e.target.value === "" ? undefined : parseInt(e.target.value)
                  )
                }
                placeholder="例: 2024 (任意)"
                min="2000"
                max="2050"
              />
              <p className="text-muted-foreground mt-1 text-xs">
                学級所属は別途「所属追加」ボタンから設定してください
              </p>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-3 border-t pt-4">
          <Button variant="outline" className="rounded-lg" onClick={onClose}>
            キャンセル
          </Button>
          <Button className="rounded-lg" onClick={handleSubmit}>
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
