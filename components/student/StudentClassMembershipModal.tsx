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
import { Textarea } from "@/components/ui/textarea"
import { CalendarIcon } from "lucide-react"

interface StudentClassMembershipModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (membershipData: {
    studentId: string
    classId: string
    startDate: Date
    endDate?: Date
    membershipType: string
    subject?: string
    notes?: string
  }) => void
  studentId?: string
  classId?: string
  availableStudents: Array<{ id: string; studentId: string; name: string }>
  availableClasses: Array<{ id: string; name: string; subject?: string; classType: string }>
  membershipToEdit?: {
    id: string
    studentId: string
    classId: string
    startDate: Date
    endDate?: Date
    membershipType: string
    subject?: string
    notes?: string
  } | null
}

const membershipTypes = [
  { value: "REGULAR", label: "通常所属" },
  { value: "TRANSFER", label: "転入" },
  { value: "TEMPORARY", label: "一時的所属" },
]

export default function StudentClassMembershipModal({
  isOpen,
  onClose,
  onSave,
  studentId: initialStudentId,
  classId: initialClassId,
  availableStudents,
  availableClasses,
  membershipToEdit,
}: StudentClassMembershipModalProps) {
  const [studentId, setStudentId] = useState(initialStudentId || "")
  const [classId, setClassId] = useState(initialClassId || "")
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [membershipType, setMembershipType] = useState("REGULAR")
  const [subject, setSubject] = useState("")
  const [notes, setNotes] = useState("")
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    if (membershipToEdit) {
      setStudentId(membershipToEdit.studentId)
      setClassId(membershipToEdit.classId)
      setStartDate(new Date(membershipToEdit.startDate))
      setEndDate(membershipToEdit.endDate ? new Date(membershipToEdit.endDate) : undefined)
      setMembershipType(membershipToEdit.membershipType)
      setSubject(membershipToEdit.subject || "")
      setNotes(membershipToEdit.notes || "")
    } else {
      setStudentId(initialStudentId || "")
      setClassId(initialClassId || "")
      setStartDate(new Date())
      setEndDate(undefined)
      setMembershipType("REGULAR")
      setSubject("")
      setNotes("")
    }
    setErrors({})
  }, [membershipToEdit, initialStudentId, initialClassId, isOpen])

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {}

    if (!studentId) {
      newErrors.studentId = "生徒を選択してください。"
    }

    if (!classId) {
      newErrors.classId = "学級を選択してください。"
    }

    if (!startDate) {
      newErrors.startDate = "開始日を選択してください。"
    }

    if (endDate && startDate && endDate <= startDate) {
      newErrors.endDate = "終了日は開始日より後の日付を選択してください。"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validateForm()) {
      return
    }

    const selectedClass = availableClasses.find(c => c.id === classId)
    const classSubject = selectedClass?.subject

    onSave({
      studentId,
      classId,
      startDate,
      endDate,
      membershipType,
      subject: classSubject || subject || undefined,
      notes: notes || undefined,
    })
  }

  const selectedClass = availableClasses.find(c => c.id === classId)
  const isSubjectClass = selectedClass?.classType === "SUBJECT"

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {membershipToEdit ? "学級所属を編集" : "学級所属を追加"}
          </DialogTitle>
          <DialogDescription>
            生徒の学級所属情報を入力してください。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {/* 生徒選択 */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="student" className="text-right">
              生徒
            </Label>
            <div className="col-span-3">
              <Select value={studentId} onValueChange={setStudentId} disabled={!!initialStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="生徒を選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {availableStudents.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name} ({student.studentId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.studentId && (
                <p className="mt-1 text-sm text-red-500">{errors.studentId}</p>
              )}
            </div>
          </div>

          {/* 学級選択 */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="class" className="text-right">
              学級
            </Label>
            <div className="col-span-3">
              <Select value={classId} onValueChange={setClassId} disabled={!!initialClassId}>
                <SelectTrigger>
                  <SelectValue placeholder="学級を選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {availableClasses.map((classItem) => (
                    <SelectItem key={classItem.id} value={classItem.id}>
                      {classItem.name}
                      {classItem.subject && ` (${classItem.subject})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.classId && (
                <p className="mt-1 text-sm text-red-500">{errors.classId}</p>
              )}
            </div>
          </div>

          {/* 開始日 */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="startDate" className="text-right">
              開始日
            </Label>
            <div className="col-span-3">
              <Input
                id="startDate"
                type="date"
                value={startDate ? startDate.toISOString().split('T')[0] : ''}
                onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : new Date())}
              />
              {errors.startDate && (
                <p className="mt-1 text-sm text-red-500">{errors.startDate}</p>
              )}
            </div>
          </div>

          {/* 終了日 */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="endDate" className="text-right">
              終了日
            </Label>
            <div className="col-span-3">
              <div className="space-y-2">
                <Input
                  id="endDate"
                  type="date"
                  value={endDate ? endDate.toISOString().split('T')[0] : ''}
                  onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : undefined)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEndDate(undefined)}
                  className="w-full"
                  type="button"
                >
                  終了日をクリア（現在も所属中）
                </Button>
              </div>
              {errors.endDate && (
                <p className="mt-1 text-sm text-red-500">{errors.endDate}</p>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                終了日が未設定の場合は現在も所属中とみなされます
              </p>
            </div>
          </div>

          {/* 所属種別 */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="membershipType" className="text-right">
              所属種別
            </Label>
            <div className="col-span-3">
              <Select value={membershipType} onValueChange={setMembershipType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {membershipTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 教科（教科別クラスでない場合のみ表示） */}
          {!isSubjectClass && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="subject" className="text-right">
                教科
              </Label>
              <div className="col-span-3">
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="教科別クラスの場合は教科名を入力"
                />
              </div>
            </div>
          )}

          {/* 備考 */}
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="notes" className="pt-2 text-right">
              備考
            </Label>
            <div className="col-span-3">
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="転校、編入、習熟度別クラスなどの詳細情報"
                rows={3}
              />
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