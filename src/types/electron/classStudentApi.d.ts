import type { Class, Prisma, Student } from "@prisma/client"

import type {
  ClassWithMemberships,
  StudentClassMembershipWithDetails,
  StudentWithMemberships,
} from "../prismaExtensions"

interface SubtotalScoreResult {
  subtotalId: string
  subtotalName: string
  subtotalGroupId: string
  subtotalGroupName: string
  score: number
  maxScore: number
}

// Student exam result type
interface StudentExamResult {
  examId: string
  examName: string
  examDate: Date | null
  tags: string[]
  totalScore: number
  maxScore: number
  scoredCount: number
  totalQuestions: number
  status: "complete" | "partial" | "unscored"
  subtotalScores: SubtotalScoreResult[]
}

/**
 * 学級・生徒・所属関連API
 */
export interface ClassStudentAPI {
  // Class related
  fetchClasses: () => Promise<ClassWithMemberships[]>
  getClassesNotInExam: (examId: string) => Promise<{
    success: boolean
    classes?: (ClassWithMemberships & { studentCount: number })[]
    error?: string
  }>
  getStudentsNotInExam: (examId: string) => Promise<{
    success: boolean
    students?: StudentWithMemberships[]
    error?: string
  }>
  createClass: (
    classData: Prisma.ClassCreateWithoutTeachersInput
  ) => Promise<ClassWithMemberships>
  updateClass: (
    classData: Prisma.ClassUpdateInput & { id: string }
  ) => Promise<ClassWithMemberships> // Ensure id is part of update
  deleteClass: (classId: string) => Promise<Class | void>

  // Student related
  fetchStudents: () => Promise<StudentWithMemberships[]>
  createStudent: (
    studentData: Prisma.StudentCreateInput
  ) => Promise<StudentWithMemberships>
  updateStudent: (
    id: string,
    studentData: Prisma.StudentUpdateInput
  ) => Promise<StudentWithMemberships>
  deleteStudent: (id: string) => Promise<Student | void>
  getStudentExamResults: (studentId: string) => Promise<StudentExamResult[]>
  exportStudentsExcel: (selectedStudentIds: string[]) => Promise<{
    success: boolean
    outputPath?: string
    error?: string
  }>
  exportClassesExcel: (selectedClassIds: string[]) => Promise<{
    success: boolean
    outputPath?: string
    error?: string
  }>

  // Student Class Membership related
  createStudentClassMembership: (
    membershipData: Prisma.StudentClassMembershipCreateInput
  ) => Promise<StudentClassMembershipWithDetails>
  updateStudentClassMembership: (
    id: string,
    membershipData: Prisma.StudentClassMembershipUpdateInput
  ) => Promise<StudentClassMembershipWithDetails>
  deleteStudentClassMembership: (id: string) => Promise<void>
  getCurrentMembershipsByStudentId: (
    studentId: string
  ) => Promise<StudentClassMembershipWithDetails[]>
  getAllMembershipsByStudentId: (
    studentId: string
  ) => Promise<StudentClassMembershipWithDetails[]>
  getCurrentMembershipsByClassId: (
    classId: string
  ) => Promise<StudentClassMembershipWithDetails[]>
  addStudentToClass: (
    studentId: string,
    classId: string,
    startDate?: Date,
    attendanceNumber?: number,
    notes?: string
  ) => Promise<StudentClassMembershipWithDetails>
  endStudentMembership: (
    membershipId: string,
    endDate?: Date
  ) => Promise<StudentClassMembershipWithDetails>
  getMembershipsByDateRange: (
    startDate: Date,
    endDate?: Date
  ) => Promise<StudentClassMembershipWithDetails[]>
}
