// 利用可能な学級の型（プロジェクトに未追加の学級）
export interface AvailableClass {
  id: string
  name: string
  studentCount: number
  isSelected: boolean
  order?: number
}

// 利用可能な生徒の型
export interface AvailableStudent {
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
  isSelected: boolean
}

export interface ProjectStudentAddModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  onStudentsAdded: () => void
}
