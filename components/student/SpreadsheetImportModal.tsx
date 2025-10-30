"use client"

import StudentImportTable from "@/components/student/StudentImportTable"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useStudentImport } from "@/hooks/useStudentImport"
import { AlertCircle, Upload } from "lucide-react"

function ValidationMessages({
  validation,
}: {
  validation: { valid: number; errors: string[]; warnings: string[] }
}) {
  return (
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
            ✅ {validation.valid}件のデータが有効です
          </div>
        </div>
      )}
    </div>
  )
}

interface ClassWithMemberships {
  id: string
  name: string
  classCode?: string | null
  grade?: number | null
  description?: string | null
  isVisible?: boolean
}

interface StudentWithMemberships {
  id: string
  studentId: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  enrollmentYear?: number | null
  memberships: Array<{
    id: string
    startDate: Date
    endDate?: Date | null
    attendanceNumber?: number | null
    notes?: string | null
    class: {
      id: string
      name: string
      classCode?: string | null
    }
  }>
}

interface SpreadsheetImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImportSuccess: (importedStudents: StudentWithMemberships[]) => void
  existingClasses: ClassWithMemberships[]
}

export default function SpreadsheetImportModal({
  isOpen,
  onClose,
  onImportSuccess,
  existingClasses,
}: SpreadsheetImportModalProps) {
  const {
    studentData,
    studentValidation,
    isProcessing,
    handleStudentDataChange,
    handleImportStudents,
  } = useStudentImport(existingClasses)

  const handleStudentImport = async () => {
    try {
      const imported = await handleImportStudents()
      if (imported) {
        onImportSuccess(imported)
        onClose()
      }
    } catch (error) {
      alert("生徒のインポートに失敗しました。")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] min-w-[95%] flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            生徒データのインポート
          </DialogTitle>
          <DialogDescription>
            Excelやスプレッドシートからコピー&ペーストで生徒データを一括登録できます。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto py-4">
          <div className="overflow-x-auto">
            <StudentImportTable
              data={studentData}
              onDataChange={handleStudentDataChange}
            />
          </div>
          <ValidationMessages validation={studentValidation} />
        </div>

        <DialogFooter className="shrink-0 border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            onClick={handleStudentImport}
            disabled={
              studentValidation.errors.length > 0 ||
              studentData.length === 0 ||
              isProcessing
            }
          >
            {isProcessing ? "登録中..." : `${studentValidation.valid}名を登録`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
