import type { ExamStudentStatus } from "@/types/examStudentStatus.types"

export interface ConvertedFile {
  id: string
  name: string
  type: string
  size: number
  buffer: ArrayBuffer
  preview?: string
  studentId?: string
  pageNumber: number
  isSelected: boolean
  originalFileName: string
  pageLabel?: string
}

export interface CropRegion {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  label: string
  examPageId?: string | null
}

export interface ExamPage {
  id: string
  pageNumber: number
  examId: string
}

export interface StudentWithAnswers {
  id: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  studentId: string
  isSelected: boolean
  hasExistingAnswers: boolean
  overwrite: boolean
  status?: ExamStudentStatus
  customOrder?: number | null
  attendanceNumber?: number | null
}

export interface UseStudentAnswerUploadProps {
  examId: string
  students: Array<{
    id: string
    lastName: string
    firstName: string
    lastNameKana: string
    firstNameKana: string
    studentId: string
    attendanceNumber?: number | null
    status?: ExamStudentStatus
    customOrder?: number | null
  }>
  onUploadComplete?: () => void
}
