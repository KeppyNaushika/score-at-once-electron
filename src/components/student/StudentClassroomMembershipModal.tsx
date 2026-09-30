"use client"

import type { Classroom } from "@prisma/client"
import { useMemo, useState } from "react"

import { Combobox } from "@/components/common/Combobox"
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
import { Textarea } from "@/components/ui/textarea"
import { classroomSearchKeywords } from "@/lib/searchKeywords"

interface MembershipSaveData {
  studentId: string
  classroomId: string
  startDate?: Date
  endDate?: Date
  attendanceNumber?: number
  notes?: string
}

interface StudentClassroomMembershipModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (membershipData: MembershipSaveData) => void
  studentId?: string
  classroomId?: string
  availableStudents: Array<{
    id: string
    studentNumber: string
    lastName: string
    firstName: string
    lastNameKana: string
    firstNameKana: string
  }>
  availableClassrooms: Classroom[]
  membershipToEdit?: {
    id: string
    studentId: string
    classroomId: string
    startDate?: Date | string | null
    endDate?: Date | string | null
    attendanceNumber?: number | null
    notes?: string | null
  } | null
}

/** Date/文字列を <input type="date"> が受け付ける YYYY-MM-DD へ整える */
const formatDateForInput = (date: Date | string | null | undefined): string => {
  if (!date) return ""
  const parsedDate = typeof date === "string" ? new Date(date) : date
  if (isNaN(parsedDate.getTime())) return ""
  return parsedDate.toISOString().split("T")[0]
}

export default function StudentClassroomMembershipModal({
  isOpen,
  onClose,
  onSave,
  studentId: initialStudentId,
  classroomId: initialClassroomId,
  availableStudents,
  availableClassrooms,
  membershipToEdit,
}: StudentClassroomMembershipModalProps) {
  // 呼び出し側は閉じている間このコンポーネントをマウントしないため、
  // 開くたびに membershipToEdit（無ければ初期指定）の内容からフォームが始まる。
  const [studentId, setStudentId] = useState(
    membershipToEdit?.studentId ?? initialStudentId ?? ""
  )
  const [classroomId, setClassroomId] = useState(
    membershipToEdit?.classroomId ?? initialClassroomId ?? ""
  )
  const [attendanceNumber, setAttendanceNumber] = useState<string>(
    membershipToEdit?.attendanceNumber?.toString() ?? ""
  )
  const [startDate, setStartDate] = useState(() =>
    formatDateForInput(membershipToEdit?.startDate)
  )
  const [endDate, setEndDate] = useState(() =>
    formatDateForInput(membershipToEdit?.endDate)
  )
  const [notes, setNotes] = useState(membershipToEdit?.notes ?? "")
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  const studentOptions = useMemo(
    () =>
      availableStudents.map((student) => ({
        value: student.id,
        label: `${student.lastName} ${student.firstName} (${student.studentNumber})`,
        keywords: [
          student.studentNumber,
          `${student.lastNameKana} ${student.firstNameKana}`,
        ],
      })),
    [availableStudents]
  )
  const classroomOptions = useMemo(
    () =>
      availableClassrooms.map((classroom) => ({
        value: classroom.id,
        label: classroom.classroomCode
          ? `${classroom.name} (${classroom.classroomCode})`
          : classroom.name,
        keywords: classroomSearchKeywords(classroom),
      })),
    [availableClassrooms]
  )

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {}

    if (!studentId) {
      newErrors.studentId = "生徒を選択してください。"
    }

    if (!classroomId) {
      newErrors.classroomId = "学級を選択してください。"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validateForm()) {
      return
    }

    onSave({
      studentId,
      classroomId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      attendanceNumber: attendanceNumber
        ? parseInt(attendanceNumber)
        : undefined,
      notes: notes || undefined,
    })
  }

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
            <div className="col-span-3 space-y-2">
              <Combobox
                id="student"
                options={studentOptions}
                value={studentId}
                onValueChange={setStudentId}
                disabled={!!initialStudentId}
                placeholder="生徒を選択してください"
                searchPlaceholder="生徒名・カナ・学籍番号で検索"
                emptyText="該当する生徒がいません"
                className="w-full"
              />
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
              <Combobox
                id="class"
                options={classroomOptions}
                value={classroomId}
                onValueChange={setClassroomId}
                disabled={!!initialClassroomId}
                placeholder="学級を選択してください"
                searchPlaceholder="学級を検索"
                emptyText="該当する学級がありません"
                className="w-full"
              />
              {errors.classroomId && (
                <p className="mt-1 text-sm text-red-500">
                  {errors.classroomId}
                </p>
              )}
            </div>
          </div>

          {/* 出席番号 */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="attendanceNumber" className="text-right">
              出席番号
            </Label>
            <div className="col-span-3">
              <Input
                id="attendanceNumber"
                type="number"
                value={attendanceNumber}
                onChange={(e) => setAttendanceNumber(e.target.value)}
                placeholder="この学級での出席番号"
                min="1"
              />
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
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                未指定の場合は今日の日付になります
              </p>
            </div>
          </div>

          {/* 終了日 */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="endDate" className="text-right">
              終了日
            </Label>
            <div className="col-span-3">
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                未指定の場合は現在所属中（終了日なし）になります
              </p>
            </div>
          </div>

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
