import type { Exam, Prisma } from "@prisma/client"

import type { ExamPageWithContent } from "@/electron-src/lib/prisma/examPage"
import type { ExamSummary } from "@/lib/examStatus"

import type { ExamStudentStatus } from "../examStudentStatus.types"
import type {
  ExamForDetail,
  ExamStudentWithMemberships,
} from "../prismaExtensions"

/** 試験スカラー + examPages（masterImages 含む）。採点画面が1クエリで取得する形。 */
export type ExamWithPages = Exam & { examPages: ExamPageWithContent[] }

// Exam作成/更新用の引数型
export interface CreateExamArgs {
  examName: string
  description?: string | null
  examDate?: Date | null
}

export interface UpdateExamArgs extends Partial<CreateExamArgs> {
  id: string
}

/**
 * 試験CRUD + 試験-生徒関連API
 */
export interface ExamAPI {
  fetchExamsSummary: (userId: string) => Promise<ExamSummary[]>
  fetchExamById: (examId: string) => Promise<ExamForDetail | null>
  /** 試験の基本スカラーのみ（リレーション無し・軽量）。編集/スカラー参照用途。 */
  getExam: (examId: string) => Promise<Exam | null>
  /** 試験スカラー + examPages を1クエリで（採点画面用）。 */
  getExamWithPages: (examId: string) => Promise<ExamWithPages | null>
  createExam: (
    examData: CreateExamArgs,
    userId: string
  ) => Promise<ExamForDetail>
  updateExam: (
    examId: string,
    data: Prisma.ExamUpdateInput
  ) => Promise<ExamForDetail>
  deleteExam: (examId: string) => Promise<Exam | void>

  // Exam-Student relationship
  getStudentsForExam: (examId: string) => Promise<{
    success: boolean
    students?: ExamStudentWithMemberships[]
    error?: string
  }>
  addStudentsToExam: (
    examId: string,
    studentIds: string[]
  ) => Promise<{
    success: boolean
    error?: string
  }>
  removeStudentsFromExam: (
    examId: string,
    studentIds: string[]
  ) => Promise<{
    success: boolean
    error?: string
  }>
  updateStudentExamStatus: (
    examId: string,
    studentId: string,
    status: ExamStudentStatus
  ) => Promise<{
    success: boolean
    error?: string
  }>
  updateStudentOrders: (
    examId: string,
    studentOrders: { studentId: string; customOrder: number }[]
  ) => Promise<{
    success: boolean
    error?: string
  }>
  checkGradingDataForStudents: (
    examId: string,
    studentIds: string[]
  ) => Promise<{
    success: boolean
    hasAnyData?: boolean
    totalGradingItems?: number
    studentData?: Record<
      string,
      {
        hasData: boolean
        studentAnswerCount: number
        questionScoreCount: number
        totalGradingItems: number
      }
    >
    error?: string
  }>
}
