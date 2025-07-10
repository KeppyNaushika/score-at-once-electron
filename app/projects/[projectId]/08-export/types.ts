// 生徒の状態を表す型
export type StudentStatus = "participating" | "expected" | "absent"

// 生徒データの型
export interface Student {
  id: string
  studentId: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  enrollmentYear?: number | null
  memberships: {
    id: string
    attendanceNumber?: number | null
    class: {
      id: string
      name: string
    }
  }[]
  status: StudentStatus
  isInProject: boolean
  customOrder?: number | null
}

// PDF用紙の向きの型
export type PdfOrientation = 'portrait' | 'landscape'

// 出力オプションの型
export interface ExportOptions {
  includeScoredAnswers: boolean
  includeIndividualReports: boolean
  includeGradingData: boolean
  format: 'pdf' | 'excel'
  markPosition: string
  markSize: number
  showMarks: boolean
  pdfOrientation: PdfOrientation
}