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

export interface LayoutRegion {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  label: string
  masterImageId?: string | null
}

export interface MasterImage {
  id: string
  pageNumber: number
  path: string
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
  status?: 'participating' | 'expected' | 'absent'
  customOrder?: number | null
  attendanceNumber?: number | null
}

export interface UseAnswerSheetUploadProps {
  projectId: string
  students: Array<{
    id: string
    lastName: string
    firstName: string
    lastNameKana: string
    firstNameKana: string
    studentId: string
    attendanceNumber?: number | null
    status?: 'participating' | 'expected' | 'absent'
    customOrder?: number | null
  }>
  onUploadComplete?: () => void
}