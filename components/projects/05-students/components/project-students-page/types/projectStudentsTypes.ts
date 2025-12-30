// 生徒の状態を表す型
export type StudentStatus = "participating" | "expected" | "absent"

// 生徒データの型（実際のデータベース構造に合わせて更新）
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

// クラスデータの型
export interface ClassGroup {
  id: string
  name: string
  students: Student[]
}

export interface GradingDataInfo {
  hasData: boolean
  totalItems: number
}

export interface StudentForRemoval {
  id: string
  studentId: string
  lastName: string
  firstName: string
  className: string
}
