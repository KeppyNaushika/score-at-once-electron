"use client"

import type { Prisma, Student } from "@prisma/client"
import { useState } from "react"

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

interface StudentModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (studentData: Prisma.StudentCreateInput) => void
  onUpdate: (id: string, studentData: Prisma.StudentUpdateInput) => void
  /** 編集する生徒の行そのもの（新規作成なら null） */
  studentToEdit: Student | null
}

export default function StudentModal({
  isOpen,
  onClose,
  onSave,
  onUpdate,
  studentToEdit,
}: StudentModalProps) {
  // 呼び出し側は閉じている間このコンポーネントをマウントしないため、
  // 開くたびに studentToEdit の内容からフォームが始まる。
  const [studentId, setStudentId] = useState(studentToEdit?.studentNumber ?? "")
  const [lastName, setLastName] = useState(studentToEdit?.lastName ?? "")
  const [firstName, setFirstName] = useState(studentToEdit?.firstName ?? "")
  const [lastNameKana, setLastNameKana] = useState(
    studentToEdit?.lastNameKana ?? ""
  )
  const [firstNameKana, setFirstNameKana] = useState(
    studentToEdit?.firstNameKana ?? ""
  )
  const [enrollmentYear, setEnrollmentYear] = useState<number | undefined>(
    studentToEdit?.enrollmentYear ?? undefined
  )
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const { inputRef: studentIdInputRef, onOpenAutoFocus } =
    useDialogAutoFocus(isOpen)

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
              className="text-right font-normal text-muted-foreground"
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
              className="text-right font-normal text-muted-foreground"
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
              className="text-right font-normal text-muted-foreground"
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
              className="text-right font-normal text-muted-foreground"
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
              className="text-right font-normal text-muted-foreground"
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
              className="text-right font-normal text-muted-foreground"
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
              <p className="mt-1 text-xs text-muted-foreground">
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
