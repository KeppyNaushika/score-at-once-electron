"use client"

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
import { useEffect, useState } from "react"

type StudentWithClass = Prisma.StudentGetPayload<{
  include: { memberships: { include: { class: true } } }
}>
interface StudentModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (studentData: Prisma.StudentCreateInput) => void
  onUpdate: (id: string, studentData: Prisma.StudentUpdateInput) => void
  studentToEdit: StudentWithClass | null
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
    undefined,
  )
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    if (studentToEdit) {
      setStudentId(studentToEdit.studentId)
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
      studentId: studentId.trim(),
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
            <Label htmlFor="lastName" className="text-right">
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
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="firstName" className="text-right">
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
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="lastNameKana" className="text-right">
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
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="firstNameKana" className="text-right">
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
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="enrollmentYear" className="text-right">
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
                    e.target.value === ""
                      ? undefined
                      : parseInt(e.target.value),
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
