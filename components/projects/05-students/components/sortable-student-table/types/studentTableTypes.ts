import type { StudentClassInfo } from "@/types/electron.d"

// 生徒の状態を表す型
export type StudentStatus = "participating" | "expected" | "absent"

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
    class: {
      id: string
      name: string
    }
  }[]
  /** ProjectClass(administered=true)から取得した学級情報 */
  projectClassInfo?: StudentClassInfo | null
  status: StudentStatus
  isInProject: boolean
  customOrder?: number | null
}

// クラスデータの型
export interface ClassGroup {
  id: string
  name: string
  students: Student[]
}

export interface SortableStudentTableProps {
  classes: ClassGroup[]
  onStudentStatusUpdate: (
    studentId: string,
    status: StudentStatus
  ) => Promise<void>
  onStudentOrderUpdate: (
    projectId: string,
    studentOrders: { studentId: string; customOrder: number }[]
  ) => Promise<void>
  selectedStudents: Set<string>
  onStudentSelectionChange: (studentId: string, isSelected: boolean) => void
  onSelectAll: (isSelected: boolean) => void
  filteredStudents: Student[]
  projectId: string
  searchTerm: string
  onSearchChange: (value: string) => void
  selectedClassId: string
  onClassChange: (value: string) => void
  statusFilter: StudentStatus | "all"
  onStatusChange: (value: StudentStatus | "all") => void
}

export interface SortableTableRowProps {
  student: Student
  isSelected: boolean
  onToggleSelection: (studentId: string, event?: React.MouseEvent) => void
  onStatusUpdate: (studentId: string, status: StudentStatus) => void
}
