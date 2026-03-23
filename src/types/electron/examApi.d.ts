import type { Exam, Prisma } from "@prisma/client"

import type { ExamListItem, ExamWithDetails } from "../common.types"
import type { StudentWithMemberships } from "../prismaExtensions"

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
  fetchExams: (userId: string) => Promise<ExamWithDetails[]>
  fetchExamsSummary: (userId: string) => Promise<ExamListItem[]>
  fetchExamById: (examId: string) => Promise<ExamWithDetails | null>
  createExam: (
    examData: CreateExamArgs,
    userId: string
  ) => Promise<ExamWithDetails>
  updateExam: (
    examId: string,
    data: Prisma.ExamUpdateInput
  ) => Promise<ExamWithDetails>
  deleteExam: (examId: string) => Promise<Exam | void>

  // Exam-Student relationship
  getStudentsForExam: (examId: string) => Promise<{
    success: boolean
    students?: (StudentWithMemberships & {
      status: "participating" | "expected" | "absent"
      isInExam: boolean
      customOrder: number | null
    })[]
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
    status: "participating" | "expected" | "absent"
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
