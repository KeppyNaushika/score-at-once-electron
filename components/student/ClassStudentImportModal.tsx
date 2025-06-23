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
import { AlertCircle, Upload } from "lucide-react"
import { useState } from "react"
import ClassStudentImportTable from "./ClassStudentImportTable"

interface ClassStudentImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImportSuccess: () => void
  classId: string
  className: string
}

interface ClassStudentImportRow {
  studentId: string
}

export default function ClassStudentImportModal({
  isOpen,
  onClose,
  onImportSuccess,
  classId,
  className,
}: ClassStudentImportModalProps) {
  const [studentData, setStudentData] = useState<ClassStudentImportRow[]>([
    { studentId: "" },
  ])
  const [isProcessing, setIsProcessing] = useState(false)
  const [validation, setValidation] = useState<{
    valid: number
    errors: string[]
    warnings: string[]
  }>({ valid: 0, errors: [], warnings: [] })

  const validateData = (data: ClassStudentImportRow[]) => {
    const errors: string[] = []
    const warnings: string[] = []
    let validCount = 0

    const nonEmptyData = data.filter((row) => row.studentId.trim() !== "")

    if (nonEmptyData.length === 0) {
      errors.push("学籍番号が入力されていません。")
      return { valid: 0, errors, warnings }
    }

    const studentIds = new Set<string>()

    nonEmptyData.forEach((row, index) => {
      const studentId = row.studentId.trim()

      if (!studentId) {
        return
      }

      if (studentIds.has(studentId)) {
        errors.push(
          `行${index + 1}: 学籍番号「${studentId}」が重複しています。`,
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
      const validStudentIds = studentData
        .filter((row) => row.studentId.trim() !== "")
        .map((row) => row.studentId.trim())

      // Add each student to the class
      for (const studentId of validStudentIds) {
        try {
          // First try to find the student by studentId
          const students = await window.electronAPI.fetchStudents()
          const student = students.find((s) => s.studentId === studentId)

          if (student) {
            await window.electronAPI.addStudentToClass(
              student.id,
              classId,
              new Date(),
              "REGULAR",
              undefined,
              `表形式インポートにより追加 - ${new Date().toLocaleDateString("ja-JP")}`,
            )
          } else {
            console.warn(`学籍番号 ${studentId} の生徒が見つかりません`)
          }
        } catch (error) {
          console.error(`学籍番号 ${studentId} の追加に失敗:`, error)
        }
      }

      onImportSuccess()
      onClose()
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
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            {className}への生徒一括追加
          </DialogTitle>
          <DialogDescription>
            学籍番号を入力して、学級に生徒を一括で追加できます。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ClassStudentImportTable
            data={studentData}
            onDataChange={handleDataChange}
          />
          <ValidationMessages validation={validation} />
        </div>

        <DialogFooter>
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
