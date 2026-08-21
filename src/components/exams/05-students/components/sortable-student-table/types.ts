import type { Classroom } from "@prisma/client"

import type { ExamClassroomPlacement } from "@/lib/examClassroomPlacement"
import type { ExamStudentStatus } from "@/types/examStudentStatus.types"
import type { ExamStudentWithMemberships } from "@/types/prismaExtensions"

export interface SortableStudentTableProps {
  classrooms: Classroom[]
  onStudentStatusUpdate: (studentId: string, status: ExamStudentStatus) => void
  /** 並び順を書き、読み直すところまで（解決した時点で手元の並びを捨てる） */
  onStudentOrderUpdate: (
    examId: string,
    studentOrders: { studentId: string; customOrder: number }[]
  ) => void | Promise<void>
  selectedStudents: Set<string>
  onStudentSelectionChange: (studentId: string, isSelected: boolean) => void
  onSelectAll: (isSelected: boolean) => void
  /** 全受験生徒（フィルタ未適用。順序リセットの対象） */
  students: ExamStudentWithMemberships[]
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
