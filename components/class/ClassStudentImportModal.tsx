"use client"

import ClassStudentImportTable from "@/components/class/ClassStudentImportTable"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ClassWithMemberships } from "@/types/electron"
import { AlertCircle, Upload } from "lucide-react"
import { useState } from "react"

// ClassWithMembershipsのmemberships配列の要素型を抽出
type ClassMembership = ClassWithMemberships["memberships"][number]

interface ClassStudentImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImportSuccess: () => void
  classId: string
  className: string
}

interface ClassStudentImportRow {
  studentId: string
  attendanceNumber: string
  startDate: string
  endDate: string
}

export default function ClassStudentImportModal({
  isOpen,
  onClose,
  onImportSuccess,
  classId,
  className,
}: ClassStudentImportModalProps) {
  const [studentData, setStudentData] = useState<ClassStudentImportRow[]>([
    { studentId: "", attendanceNumber: "", startDate: "", endDate: "" },
  ])
  const [isProcessing, setIsProcessing] = useState(false)
  const [validation, setValidation] = useState<{
    valid: number
    errors: string[]
    warnings: string[]
  }>({ valid: 0, errors: [], warnings: [] })

  const isValidDate = (dateStr: string): boolean => {
    const regex = /^\d{4}\/\d{1,2}\/\d{1,2}$/
    if (!regex.test(dateStr)) return false
    const date = new Date(dateStr.replace(/\//g, "-"))
    return date instanceof Date && !isNaN(date.getTime())
  }

  const validateData = (data: ClassStudentImportRow[]) => {
    const errors: string[] = []
    const warnings: string[] = []
    let validCount = 0

    const nonEmptyData = data.filter(
      (row) =>
        row.studentId.trim() !== "" ||
        row.attendanceNumber.trim() !== "" ||
        row.startDate.trim() !== "" ||
        row.endDate.trim() !== ""
    )

    if (nonEmptyData.length === 0) {
      errors.push("学籍番号が入力されていません。")
      return { valid: 0, errors, warnings }
    }

    const studentIds = new Set<string>()

    nonEmptyData.forEach((row, index) => {
      const studentId = row.studentId.trim()
      const attendanceNumber = row.attendanceNumber.trim()

      if (!studentId) {
        errors.push(`行${index + 1}: 学籍番号が入力されていません。`)
        return
      }

      if (attendanceNumber && isNaN(parseInt(attendanceNumber))) {
        errors.push(`行${index + 1}: 出席番号は数値で入力してください。`)
        return
      }

      // 日付のバリデーション
      if (row.startDate.trim() && !isValidDate(row.startDate.trim())) {
        errors.push(
          `行${index + 1}: 開始日の形式が不正です。YYYY/M/D形式で入力してください。`
        )
        return
      }

      if (row.endDate.trim() && !isValidDate(row.endDate.trim())) {
        errors.push(
          `行${index + 1}: 終了日の形式が不正です。YYYY/M/D形式で入力してください。`
        )
        return
      }

      if (studentIds.has(studentId)) {
        errors.push(
          `行${index + 1}: 学籍番号「${studentId}」が重複しています。`
        )
        return
      }

      studentIds.add(studentId)
      validCount++
    })

    return { valid: validCount, errors, warnings }
  }

  const handleDataChange = (data: ClassStudentImportRow[]) => {
    setStudentData(data)
    const validationResult = validateData(data)
    setValidation(validationResult)
  }

  const handleImport = async () => {
    if (validation.errors.length > 0 || validation.valid === 0) {
      return
    }

    setIsProcessing(true)
    try {
      const validRows = studentData.filter((row) => row.studentId.trim() !== "")

      let successCount = 0
      let notFoundStudents: string[] = []

      for (const row of validRows) {
        try {
          const studentId = row.studentId.trim()
          const attendanceNumber = row.attendanceNumber.trim()

          const students = await window.electronAPI.fetchStudents()
          const student = students.find((s) => s.studentId === studentId)

          if (student) {
            // 既存のメンバーシップをチェック
            const classes = await window.electronAPI.fetchClasses()
            const targetClass = classes.find((c) => c.id === classId)
            const existingMembership = targetClass?.memberships.find(
              (m: ClassMembership) => m.student.id === student.id
            )

            if (existingMembership) {
              // 既存のメンバーシップがある場合は終了してから新規追加
              await window.electronAPI.endStudentMembership(
                existingMembership.id
              )
            }

            const startDate = row.startDate.trim()
              ? new Date(row.startDate.trim().replace(/\//g, "-"))
              : new Date()
            const endDateStr = row.endDate.trim()

            await window.electronAPI.addStudentToClass(
              student.id,
              classId,
              startDate,
              attendanceNumber ? parseInt(attendanceNumber) : undefined
            )

            const verifyClasses = await window.electronAPI.fetchClasses()
            const verifyClass = verifyClasses.find((c) => c.id === classId)
            const addedMembership = verifyClass?.memberships
              .filter((m: ClassMembership) => m.student.id === student.id)
              .sort(
                (a: ClassMembership, b: ClassMembership) =>
                  new Date(b.startDate).getTime() -
                  new Date(a.startDate).getTime()
              )[0]

            if (!addedMembership) {
              throw new Error("データベースへの保存に失敗しました")
            }

            // 終了日が指定されている場合は、追加後に終了処理
            if (endDateStr) {
              const newClasses = await window.electronAPI.fetchClasses()
              const newTargetClass = newClasses.find((c) => c.id === classId)
              // 最新のメンバーシップを取得（開始日でソート）
              const newMembership = newTargetClass?.memberships
                .filter((m: ClassMembership) => m.student.id === student.id)
                .sort(
                  (a: ClassMembership, b: ClassMembership) =>
                    new Date(b.startDate).getTime() -
                    new Date(a.startDate).getTime()
                )[0]
              if (newMembership) {
                await window.electronAPI.endStudentMembership(
                  newMembership.id,
                  new Date(endDateStr.replace(/\//g, "-"))
                )
              }
            }
            successCount++
          } else {
            console.warn(`学籍番号 ${studentId} の生徒が見つかりません`)
            notFoundStudents.push(studentId)
          }
        } catch (error) {
          console.error(`学籍番号 ${row.studentId} の追加に失敗:`, error)
          alert(
            `学籍番号 ${row.studentId} の追加中にエラーが発生しました: ${error}`
          )
        }
      }

      if (notFoundStudents.length > 0) {
        alert(
          `次の学籍番号の生徒が見つかりませんでした:\n${notFoundStudents.join(", ")}\n\nまず生徒マスターに登録してください。`
        )
      }

      if (successCount > 0) {
        alert(`${successCount}名の生徒を学級に追加しました。`)
        await onImportSuccess()
        onClose()
      } else if (notFoundStudents.length === 0) {
        alert("追加する生徒がありません。")
      }
    } catch (error) {
      console.error("学級への生徒追加に失敗:", error)
      alert("学級への生徒追加に失敗しました。")
    } finally {
      setIsProcessing(false)
    }
  }

  const ValidationMessages = ({
    validation,
  }: {
    validation: { valid: number; errors: string[]; warnings: string[] }
  }) => (
    <div className="space-y-2">
      {validation.errors.length > 0 && (
        <div className="rounded-md bg-red-50 p-3">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">エラー</h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc space-y-1 pl-5">
                  {validation.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="rounded-md bg-yellow-50 p-3">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">警告</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <ul className="list-disc space-y-1 pl-5">
                  {validation.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {validation.valid > 0 && (
        <div className="rounded-md bg-green-50 p-3">
          <div className="text-sm text-green-700">
            ✅ {validation.valid}件の学籍番号が有効です
          </div>
        </div>
      )}
    </div>
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {className}への生徒一括追加
          </DialogTitle>
          <DialogDescription>
            学籍番号、出席番号、所属期間を入力して、学級に生徒を一括で追加できます。
            同じ学籍番号の生徒が既に在籍中の場合は上書きされます。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto py-4">
          <div className="overflow-x-auto">
            <ClassStudentImportTable
              data={studentData}
              onDataChange={handleDataChange}
            />
          </div>
          <ValidationMessages validation={validation} />
        </div>

        <DialogFooter className="shrink-0 border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            onClick={handleImport}
            disabled={
              validation.errors.length > 0 ||
              validation.valid === 0 ||
              isProcessing
            }
          >
            {isProcessing ? "追加中..." : `${validation.valid}名を追加`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
