"use client"

import { ClipboardPaste } from "lucide-react"
import { toast } from "sonner"

import ImportValidationMessages from "@/components/common/ImportValidationMessages"
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
import { summarizeStudentNumbers } from "@/lib/studentNumberSummary"
import type { StudentWithMemberships } from "@/types/prismaExtensions"

interface SpreadsheetImportModalProps {
  isOpen: boolean
  onClose: () => void
  /** 既に登録済みの生徒。重複行の判定に使う（呼び出し元が読み込み済みのものを渡す） */
  existingStudents: StudentWithMemberships[]
  onImportSuccess: (importedStudents: StudentWithMemberships[]) => void
}

export default function SpreadsheetImportModal({
  isOpen,
  onClose,
  existingStudents,
  onImportSuccess,
}: SpreadsheetImportModalProps) {
  const {
    studentData,
    studentValidation,
    isProcessing,
    handleStudentDataChange,
    handleImportStudents,
  } = useStudentImport(existingStudents)

  const handleStudentImport = async () => {
    try {
      const outcome = await handleImportStudents()
      if (!outcome) return
      const { importedStudents, failedStudentNumbers } = outcome

      if (failedStudentNumbers.length > 0) {
        toast.error(
          `${failedStudentNumbers.length}名の生徒を登録できませんでした`,
          { description: summarizeStudentNumbers(failedStudentNumbers) }
        )
      }

      if (importedStudents.length > 0) {
        toast.success(
          `${importedStudents.length}名の生徒を生徒管理に登録しました`
        )
        onImportSuccess(importedStudents)
        onClose()
      }
    } catch (error) {
      console.error("生徒の登録に失敗:", error)
      toast.error("生徒を登録できませんでした")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] min-w-[95%] flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ClipboardPaste className="h-5 w-5" />
            生徒データの取り込み
          </DialogTitle>
          <DialogDescription>
            Excelやスプレッドシートからコピー&ペーストで生徒データを一括登録できます。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="overflow-x-auto">
            <StudentImportTable
              data={studentData}
              onDataChange={handleStudentDataChange}
            />
          </div>
          <ImportValidationMessages
            validation={studentValidation}
            validRowNoun="データ"
          />
        </div>

        <DialogFooter className="shrink-0 border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            onClick={handleStudentImport}
            disabled={
              studentValidation.errors.length > 0 ||
              studentValidation.valid === 0 ||
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
