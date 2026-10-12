"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ClipboardPaste } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import ClassroomStudentImportTable from "@/components/classroom/ClassroomStudentImportTable"
import {
  type ClassroomStudentImportRow,
  validateClassroomStudentImportRows,
} from "@/components/classroom/classroomStudentImportValidation"
import ImportValidationMessages from "@/components/common/ImportValidationMessages"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { summarizeStudentNumbers } from "@/lib/studentNumberSummary"
import {
  addStudentToClassroomMutation,
  endStudentMembershipMutation,
  studentListQuery,
} from "@/queries/student"

interface ClassroomStudentImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImportSuccess: () => void
  classroomId: string
  className: string
}

export default function ClassroomStudentImportModal({
  isOpen,
  onClose,
  onImportSuccess,
  classroomId,
  className,
}: ClassroomStudentImportModalProps) {
  const [studentData, setStudentData] = useState<ClassroomStudentImportRow[]>([
    { studentId: "", attendanceNumber: "", startDate: "", endDate: "" },
  ])
  const [isProcessing, setIsProcessing] = useState(false)
  const queryClient = useQueryClient()
  const addStudentToClassroom = useMutation(addStudentToClassroomMutation())
  const endStudentMembership = useMutation(endStudentMembershipMutation())
  // 開いた直後は何も言わない（空の1行を検証すると「未入力」のエラーが出てしまう）
  const [validation, setValidation] = useState<
    ReturnType<typeof validateClassroomStudentImportRows>
  >({ validRows: [], errors: [], warnings: [] })
  const validCount = validation.validRows.length

  const handleDataChange = (rows: ClassroomStudentImportRow[]) => {
    setStudentData(rows)
    setValidation(validateClassroomStudentImportRows(rows))
  }

  const handleImport = async () => {
    if (validation.errors.length > 0 || validCount === 0) {
      return
    }

    setIsProcessing(true)
    try {
      // 生徒一覧を一度だけ取得（N+1問題の修正）
      const students = await queryClient.fetchQuery(studentListQuery())
      const studentByNumber = new Map(
        students.map((student) => [student.studentNumber, student])
      )

      let successCount = 0
      const notFoundStudentNumbers: string[] = []
      const failedStudentNumbers: string[] = []

      // 検証を通った行だけを取り込む（表示した件数と一致させる）
      for (const row of validation.validRows) {
        const studentNumber = row.studentId.trim()
        const student = studentByNumber.get(studentNumber)

        if (!student) {
          notFoundStudentNumbers.push(studentNumber)
          continue
        }

        try {
          const attendanceNumber = row.attendanceNumber.trim()
          const startDate = row.startDate.trim()
            ? new Date(row.startDate.trim().replace(/\//g, "-"))
            : new Date()
          const endDateText = row.endDate.trim()

          // バックエンド側で重複チェック・既存所属終了を処理
          const membership = await addStudentToClassroom.mutateAsync({
            studentId: student.id,
            classroomId,
            startDate,
            attendanceNumber: attendanceNumber
              ? parseInt(attendanceNumber)
              : undefined,
          })

          // 終了日が指定されている場合は所属を終了
          if (endDateText) {
            await endStudentMembership.mutateAsync({
              membershipId: membership.id,
              endDate: new Date(endDateText.replace(/\//g, "-")),
            })
          }

          successCount++
        } catch (error) {
          // 1件ごとの失敗は書き込みの共通のトーストが知らせる。ここでは番号を集めて最後にまとめる
          console.error(`学籍番号 ${studentNumber} の追加に失敗:`, error)
          failedStudentNumbers.push(studentNumber)
        }
      }

      if (notFoundStudentNumbers.length > 0) {
        toast.error(
          `${notFoundStudentNumbers.length}名の学籍番号が生徒管理に見つかりませんでした。先に生徒管理で登録してください`,
          { description: summarizeStudentNumbers(notFoundStudentNumbers) }
        )
      }

      if (failedStudentNumbers.length > 0) {
        toast.error(
          `${failedStudentNumbers.length}名の生徒を学級に追加できませんでした`,
          { description: summarizeStudentNumbers(failedStudentNumbers) }
        )
      }

      if (successCount > 0) {
        toast.success(`${successCount}名の生徒を学級に追加しました`)
        onImportSuccess()
        onClose()
      }
    } catch (error) {
      console.error("学級への生徒追加に失敗:", error)
      toast.error("生徒を学級に追加できませんでした")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] min-w-[95%] flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="h-5 w-5" />
            {className}への生徒一括追加
          </DialogTitle>
          <DialogDescription>
            学籍番号、出席番号、所属期間を入力して、学級に生徒を一括で追加できます。
            同じ学籍番号の生徒が既に在籍中の場合は上書きされます。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="overflow-x-auto">
            <ClassroomStudentImportTable
              data={studentData}
              onDataChange={handleDataChange}
            />
          </div>

          <ImportValidationMessages
            validation={{
              valid: validCount,
              errors: validation.errors,
              warnings: validation.warnings,
            }}
            validRowNoun="学籍番号"
          />
        </div>

        <DialogFooter className="shrink-0 border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            onClick={handleImport}
            disabled={
              validation.errors.length > 0 || validCount === 0 || isProcessing
            }
          >
            {isProcessing ? "追加中..." : `${validCount}名を追加`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
