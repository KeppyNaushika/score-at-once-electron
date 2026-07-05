import type { RosterClassOption } from "@/components/common/roster-table"
import type { ExamClassroomPlacement } from "@/lib/examClassroomPlacement"
import type { ExamStudentStatus } from "@/types/examStudentStatus.types"
import type { ExamStudentWithDetails } from "@/types/prismaExtensions"

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
  filteredStudents: ExamStudentWithDetails[]
  /** ExamClass 由来の表示学級情報（studentId キーの side data） */
  placementByStudent: Record<string, ExamClassroomPlacement>
  examId: string
  searchTerm: string
  onSearchChange: (value: string) => void
  selectedClassId: string
  onClassChange: (value: string) => void
  statusFilter: ExamStudentStatus | "all"
  onStatusChange: (value: ExamStudentStatus | "all") => void
}
