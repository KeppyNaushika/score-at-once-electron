import type { StudentClassInfo } from "@/types/electron.d"

// 生徒の状態を表す型
export type StudentStatus = "participating" | "expected" | "absent"

// 所属情報の型
export interface StudentMembership {
  id: string
  attendanceNumber?: number | null
  class: {
    id: string
    name: string
  }
}

// 生徒データの型（実際のデータベース構造に合わせて更新）
export interface Student {
  id: string
  studentNumber: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  enrollmentYear?: number | null
  memberships: StudentMembership[]
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

export interface GradingDataInfo {
  hasData: boolean
  totalItems: number
}

export interface StudentForRemoval {
  id: string
  studentNumber: string
  lastName: string
  firstName: string
  className: string
}
