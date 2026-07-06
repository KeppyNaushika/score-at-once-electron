import type { RosterClassroomOption } from "@/components/common/roster-table"
import type { ExamClassroomPlacement } from "@/lib/examClassroomPlacement"
import type { ExamStudentStatus } from "@/types/examStudentStatus.types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

export interface SortableStudentTableProps {
  classrooms: RosterClassroomOption[]
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
  filteredStudents: ExamStudentWithMemberships[]
  /** ExamClassroom 由来の表示学級情報（studentId キーの side data） */
  placementByStudent: Record<string, ExamClassroomPlacement>
  examId: string
  searchTerm: string
  onSearchChange: (value: string) => void
  selectedClassroomId: string
  onClassroomChange: (value: string) => void
  statusFilter: ExamStudentStatus | "all"
  onStatusChange: (value: ExamStudentStatus | "all") => void
}
