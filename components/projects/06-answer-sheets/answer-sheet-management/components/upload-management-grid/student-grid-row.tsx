"use client"

import { AnswerCell } from "@/components/projects/06-answer-sheets/answer-sheet-management/components/upload-management-grid/answer-cell"
import { StudentCell } from "@/components/projects/06-answer-sheets/answer-sheet-management/components/upload-management-grid/student-cell"
import type { StudentGridRowProps } from "@/components/projects/06-answer-sheets/answer-sheet-management/types"
import { TableRow } from "@/components/ui/table"

export function StudentGridRow({
  student,
  maxPages,
  pageStates,
  cellStates,
  fileStates,
  files,
  isStudentDisabled,
  onToggleStudent,
  onToggleCell,
  onToggleFile,
  onRemoveFile,
  onCellClick,
}: StudentGridRowProps) {
  // 生徒に関連するファイルを取得
  const getFileForCell = (pageNumber: number) => {
    return (
      files.find(
        (file) =>
          file.studentId === student.id && file.pageNumber === pageNumber,
      ) || null
    )
  }

  return (
    <TableRow className="border-border border-b">
      {/* 生徒情報セル */}
      <StudentCell
        student={student}
        isEnabled={!isStudentDisabled}
        onToggle={onToggleStudent}
      />

      {/* 答案セル */}
      {Array.from({ length: maxPages }, (_, i) => {
        const pageNumber = i + 1
        const cellKey = `${student.id}-${pageNumber}`
        const file = getFileForCell(pageNumber)
        const isPageDisabled = pageStates.has(i)
        const isCellDisabled = cellStates.has(cellKey)
        const isFileDisabled = file ? fileStates.has(file.id) : false

        return (
          <AnswerCell
            key={cellKey}
            student={student}
            pageNumber={pageNumber}
            file={file}
            isStudentDisabled={isStudentDisabled}
            isPageDisabled={isPageDisabled}
            isCellDisabled={isCellDisabled}
            isFileDisabled={isFileDisabled}
            onToggleFile={file ? () => onToggleFile(file.id) : undefined}
            onRemoveFile={file ? () => onRemoveFile(file.id) : undefined}
            onCellClick={() => onCellClick(student.id, pageNumber)}
          />
        )
      })}
    </TableRow>
  )
}
