import type { RosterClassOption } from "@/components/common/roster-table"
import type { StudentClassInfo } from "@/types/electron/examClassApi"
import type { ExamStudentStatus } from "@/types/examStudentStatus.types"

// 生徒データの型
export interface Student {
  id: string
  studentNumber: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  enrollmentYear?: number | null
  memberships: {
    id: string
    attendanceNumber?: number | null
    classroom: {
      id: string
      name: string
    }
  }[]
  /** ExamClass(administered=true)から取得した学級情報 */
  examClassInfo?: StudentClassInfo | null
  status: ExamStudentStatus
  customOrder?: number | null
  answerSheetCount: number
}

export interface SortableStudentTableProps {
  classes: RosterClassOption[]
  onStudentStatusUpdate: (
    studentId: string,
    status: ExamStudentStatus
  ) => Promise<void>
  onStudentOrderUpdate: (
    examId: string,
    studentOrders: { studentId: string; customOrder: number }[]
  ) => Promise<void>
  selectedStudents: Set<string>
  onStudentSelectionChange: (studentId: string, isSelected: boolean) => void
  onSelectAll: (isSelected: boolean) => void
  filteredStudents: Student[]
  examId: string
  searchTerm: string
  onSearchChange: (value: string) => void
  selectedClassId: string
  onClassChange: (value: string) => void
  statusFilter: ExamStudentStatus | "all"
  onStatusChange: (value: ExamStudentStatus | "all") => void
}
