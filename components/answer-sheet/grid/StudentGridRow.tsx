"use client"

import { TableCell, TableRow } from "@/components/ui/table"
import StudentCell from "./StudentCell"
import AnswerCell from "./AnswerCell"

interface Student {
  id: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  studentId: string
  attendanceNumber?: number | null
  status?: 'participating' | 'expected' | 'absent'
  customOrder?: number | null
}

interface ConvertedFile {
  id: string
  name: string
  type: string
  size: number
  preview?: string
  studentId?: string
  pageNumber: number
  isSelected: boolean
  pageLabel?: string
  buffer: ArrayBuffer
  originalFileName: string
}

interface CellState {
  isEnabled: boolean
  isSkipped: boolean
  file?: ConvertedFile
  isFileDisabled?: boolean
}

interface StudentState {
  isEnabled: boolean
  isSkipped: boolean
  cells: Record<number, CellState>
}

interface PageState {
  isEnabled: boolean
  isSkipped: boolean
}

interface StudentGridRowProps {
  student: Student
  maxPages: number
  studentState?: StudentState
  pageStates: Record<number, PageState>
  onToggleStudent: () => void
  onToggleCell: (pageNumber: number) => void
  onToggleFileDisabled: (pageNumber: number) => void
  onRemoveFile: (pageNumber: number) => void
}

export default function StudentGridRow({
  student,
  maxPages,
  studentState,
  pageStates,
  onToggleStudent,
  onToggleCell,
  onToggleFileDisabled,
  onRemoveFile
}: StudentGridRowProps) {
  
  const isStudentEnabled = studentState?.isEnabled ?? true
  const isStudentSkipped = studentState?.isSkipped ?? false
  
  return (
    <TableRow 
      className={`
        ${!isStudentEnabled || isStudentSkipped ? 'bg-muted/50 opacity-60' : 'bg-background'}
        hover:bg-muted/30 transition-colors
      `}
    >
      {/* 生徒情報セル */}
      <StudentCell
        student={student}
        isEnabled={isStudentEnabled}
        isSkipped={isStudentSkipped}
        onToggle={onToggleStudent}
      />

      {/* 答案セル（各ページ） */}
      {Array.from({ length: maxPages }, (_, i) => {
        const pageNumber = i + 1
        const cellState = studentState?.cells[pageNumber]
        const pageState = pageStates[pageNumber]
        
        // セルが有効かどうかの判定
        const isCellEnabled = 
          isStudentEnabled && 
          !isStudentSkipped && 
          (pageState?.isEnabled ?? true) && 
          !pageState?.isSkipped &&
          (cellState?.isEnabled ?? true) &&
          !cellState?.isSkipped
        
        return (
          <AnswerCell
            key={pageNumber}
            pageNumber={pageNumber}
            studentId={student.id}
            file={cellState?.file}
            isEnabled={isCellEnabled}
            isSkipped={cellState?.isSkipped ?? false}
            isFileDisabled={cellState?.isFileDisabled ?? false}
            isStudentDisabled={!isStudentEnabled || isStudentSkipped}
            isPageDisabled={!pageState?.isEnabled || pageState?.isSkipped}
            onToggle={() => onToggleCell(pageNumber)}
            onToggleFileDisabled={() => onToggleFileDisabled(pageNumber)}
            onRemoveFile={() => onRemoveFile(pageNumber)}
          />
        )
      })}
    </TableRow>
  )
}