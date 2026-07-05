import type { UnifiedStudent } from "@/components/exams/06-student-answers/types"

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

export type StudentWithAnswers = UnifiedStudent & {
  isSelected: boolean
  hasExistingAnswers: boolean
  overwrite: boolean
}

export interface UseStudentAnswerUploadProps {
  examId: string
  students: UnifiedStudent[]
  onUploadComplete?: () => void
}
