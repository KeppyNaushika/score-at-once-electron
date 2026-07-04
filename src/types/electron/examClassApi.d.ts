import type { Classroom, Exam, ExamClassroom } from "@prisma/client"

import type { ClassroomWithMemberships } from "../prismaExtensions"

/**
 * ExamClassroom with class details
 */
export interface ExamClassWithDetails {
  id: string
  examId: string
  classroomId: string
  administered: boolean
  teacherStatistics: boolean
  studentReport: boolean
  order: number
  createdAt: Date
  updatedAt: Date
  classroom: Classroom
  exam: Exam
}

/**
 * ExamClassroom with class and membership details
 */
export interface ExamClassWithClass {
  id: string
  examId: string
  classroomId: string
  administered: boolean
  teacherStatistics: boolean
  studentReport: boolean
  order: number
  createdAt: Date
  updatedAt: Date
  classroom: ClassroomWithMemberships
}

/**
 * Available class for adding to ExamClassroom
 */
export interface AvailableClass {
  id: string
  name: string
  classCode: string | null
  grade: number | null
  studentCount: number
}

/**
 * 生徒の学級・出席番号情報（ExamClassroom経由で取得）
 */
export interface StudentClassInfo {
  className: string | null
  classCode: string | null
  grade: number | null
  attendanceNumber: number | null
  /** ExamClassroom の並び順 */
  classOrder: number | null
}

/**
 * ExamClassroom関連API
 */
export interface ExamClassAPI {
  examClassroom: {
    /**
     * 試験に関連付けられた全クラスを取得
     */
    getAll: (examId: string) => Promise<ExamClassWithClass[]>

    /**
     * 受験生徒追加用クラスを取得 (administered=true)
     */
    getAdministered: (examId: string) => Promise<ExamClassWithClass[]>

    /**
     * 試験に追加可能なクラスを取得（まだExamClassroomに含まれていないクラス）
     */
    getAvailable: (examId: string) => Promise<AvailableClass[]>

    /**
     * 試験にクラスを追加
     */
    add: (options: {
      examId: string
      classroomId: string
      administered?: boolean
      teacherStatistics?: boolean
      studentReport?: boolean
    }) => Promise<ExamClassWithDetails>

    /**
     * ExamClassroomを更新
     */
    update: (options: {
      id: string
      administered?: boolean
      teacherStatistics?: boolean
      studentReport?: boolean
      order?: number
    }) => Promise<ExamClassWithDetails>

    /**
     * ExamClassroomを削除 (idで指定)
     */
    remove: (id: string) => Promise<ExamClassroom>

    /**
     * ExamClassroomの順序を一括更新
     */
    reorder: (options: {
      examId: string
      orderedIds: string[]
    }) => Promise<void>

    /**
     * ExamClassroomを削除 (examIdとclassroomIdで指定)
     */
    removeByIds: (examId: string, classroomId: string) => Promise<ExamClassroom>

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
      examClassroom: ExamClassroom
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
