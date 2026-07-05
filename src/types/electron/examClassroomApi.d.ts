import type { ExamClassroom } from "@prisma/client"

import type {
  AddExamClassroomOptions,
  ExamClassroomWithDetails,
  ExamClassroomWithMemberships,
  UpdateExamClassroomOptions,
} from "@/electron-src/lib/prisma/examClassroom"

/**
 * Available class for adding to ExamClassroom
 */
export interface AvailableClassroom {
  id: string
  name: string
  classroomCode: string | null
  grade: number | null
  studentCount: number
}

/**
 * ExamClassroom関連API
 */
export interface ExamClassroomAPI {
  examClassroom: {
    /**
     * 試験に関連付けられた全クラスを取得
     */
    getAll: (examId: string) => Promise<ExamClassroomWithMemberships[]>

    /**
     * 受験生徒追加用クラスを取得 (administered=true)
     */
    getAdministered: (examId: string) => Promise<ExamClassroomWithMemberships[]>

    /**
     * 試験に追加可能なクラスを取得（まだExamClassroomに含まれていないクラス）
     */
    getAvailable: (examId: string) => Promise<AvailableClassroom[]>

    /**
     * 試験にクラスを追加
     */
    add: (options: AddExamClassroomOptions) => Promise<ExamClassroomWithDetails>

    /**
     * ExamClassroomを更新
     */
    update: (
      options: UpdateExamClassroomOptions
    ) => Promise<ExamClassroomWithDetails>

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
    addStudentsFromClassroom: (
      examId: string,
      classroomId: string,
      activeOnly?: boolean
    ) => Promise<{
      added: number
      skipped: number
      examClassroom: ExamClassroom
    }>
  }
}
