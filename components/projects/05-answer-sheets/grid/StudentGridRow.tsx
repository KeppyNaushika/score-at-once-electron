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

interface CellData {
  type: "disabled" | "file" | "empty"
  position: number
  file?: ConvertedFile
}

interface StudentGridRowProps {
  student: Student
  studentIndex: number
  maxPages: number
  isStudentDisabled: boolean
  tableData: CellData[]
  nameRegions?: Record<number, { x: number, y: number, width: number, height: number } | null>
  globalPreviewMode?: 'full' | 'name'
  onToggleStudent: () => void
  onToggleCell: (pageNumber: number) => void
  onToggleFileDisabled: (pageNumber: number) => void
  onRemoveFile: (pageNumber: number) => void
  onFileClick?: (file: ConvertedFile) => void
}

export default function StudentGridRow({
  student,
  studentIndex,
  maxPages,
  isStudentDisabled,
  tableData,
  nameRegions,
  globalPreviewMode,
  onToggleStudent,
  onToggleCell,
  onToggleFileDisabled,
  onRemoveFile
}: StudentGridRowProps) {
  const isStudentEnabled = !isStudentDisabled
  const isStudentSkipped = false
  
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
        const cellData = tableData[i]
        
        // セルが有効かどうかの判定
        const isCellEnabled = 
          isStudentEnabled && 
          cellData?.type !== "disabled"
        
        const cellId = `${studentIndex}-${pageNumber}`
        
        return (
          <AnswerCell
            key={pageNumber}
            cellId={cellId}
            pageNumber={pageNumber}
            studentId={student.id}
            file={cellData?.file}
            isEnabled={isCellEnabled}
            isSkipped={false}
            isFileDisabled={false}
            isStudentDisabled={!isStudentEnabled}
            isPageDisabled={false}
            nameRegion={nameRegions?.[pageNumber]}
            globalPreviewMode={globalPreviewMode}
            onToggle={() => onToggleCell(pageNumber)}
            onToggleFileDisabled={() => onToggleFileDisabled(pageNumber)}
            onRemoveFile={() => onRemoveFile(pageNumber)}
          />
        )
      })}
    </TableRow>
  )
}