import type { Classroom, Exam, ExamClass } from "@prisma/client"

import type { ClassWithMemberships } from "../prismaExtensions"

/**
 * ExamClass with class details
 */
export interface ExamClassWithDetails {
  id: string
  examId: string
  classroomId: string
  administered: boolean
  teacherStat: boolean
  studentReport: boolean
  order: number
  createdAt: Date
  updatedAt: Date
  classroom: Classroom
  exam: Exam
}

/**
 * ExamClass with class and membership details
 */
export interface ExamClassWithClass {
  id: string
  examId: string
  classroomId: string
  administered: boolean
  teacherStat: boolean
  studentReport: boolean
  order: number
  createdAt: Date
  updatedAt: Date
  classroom: ClassWithMemberships
}

/**
 * Available class for adding to ExamClass
 */
export interface AvailableClass {
  id: string
  name: string
  classCode: string | null
  grade: number | null
  studentCount: number
}

/**
 * 生徒の学級・出席番号情報（ExamClass経由で取得）
 */
export interface StudentClassInfo {
  className: string | null
  classCode: string | null
  grade: number | null
  attendanceNumber: number | null
  /** ExamClass の並び順 */
  classOrder: number | null
}

/**
 * ExamClass関連API
 */
export interface ExamClassAPI {
  examClass: {
    /**
     * 試験に関連付けられた全クラスを取得
     */
    getAll: (examId: string) => Promise<ExamClassWithClass[]>

    /**
     * 受験生徒追加用クラスを取得 (administered=true)
     */
    getAdministered: (examId: string) => Promise<ExamClassWithClass[]>

    /**
     * 試験に追加可能なクラスを取得（まだExamClassに含まれていないクラス）
     */
    getAvailable: (examId: string) => Promise<AvailableClass[]>

    /**
     * 試験にクラスを追加
     */
    add: (options: {
      examId: string
      classroomId: string
      administered?: boolean
      teacherStat?: boolean
      studentReport?: boolean
    }) => Promise<ExamClassWithDetails>

    /**
     * ExamClassを更新
     */
    update: (options: {
      id: string
      administered?: boolean
      teacherStat?: boolean
      studentReport?: boolean
      order?: number
    }) => Promise<ExamClassWithDetails>

    /**
     * ExamClassを削除 (idで指定)
     */
    remove: (id: string) => Promise<ExamClass>

    /**
     * ExamClassの順序を一括更新
     */
    reorder: (options: {
      examId: string
      orderedIds: string[]
    }) => Promise<void>

    /**
     * ExamClassを削除 (examIdとclassroomIdで指定)
     */
    removeByIds: (examId: string, classroomId: string) => Promise<ExamClass>

    /**
     * クラスから生徒を試験に追加（B案: 統合型フロー）
     */
    addStudentsFromClass: (
      examId: string,
      classroomId: string,
      activeOnly?: boolean
    ) => Promise<{
      added: number
      skipped: number
      examClass: ExamClass
    }>

    /**
     * 試験内の全生徒の学級・出席番号情報を取得
     */
    getStudentClassInfo: (
      examId: string
    ) => Promise<Record<string, StudentClassInfo>>

    /**
     * 単一生徒の学級・出席番号情報を取得
     */
    getStudentClassInfoSingle: (
      examId: string,
      studentId: string
    ) => Promise<StudentClassInfo>
  }
}
