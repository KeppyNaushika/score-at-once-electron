import type { Classroom, Prisma, Student } from "@prisma/client"

import type {
  ClassroomWithMemberships,
  StudentClassroomMembershipWithDetails,
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

interface ClassStudentExamResult {
  studentId: string
  studentNumber: string
  studentName: string
  attendanceNumber: number | null
  examResults: StudentExamResult[]
}

/**
 * 学級・生徒・所属関連API
 */
export interface ClassroomStudentAPI {
  // Class related
  fetchClasses: () => Promise<ClassroomWithMemberships[]>
  getClassesNotInExam: (
    examId: string,
    activeOnly?: boolean
  ) => Promise<{
    success: boolean
    classes?: Array<{
      id: string
      name: string
      classCode: string | null
      grade: number | null
      studentCount: number
      studentNames: string[]
    }>
    error?: string
  }>
  getStudentsNotInExam: (
    examId: string,
    activeOnly?: boolean
  ) => Promise<{
    success: boolean
    students?: StudentWithMemberships[]
    error?: string
  }>
  createClass: (
    classData: Prisma.ClassroomCreateWithoutTeachersInput
  ) => Promise<ClassroomWithMemberships>
  updateClass: (
    classData: Prisma.ClassroomUpdateInput & { id: string }
  ) => Promise<ClassroomWithMemberships> // Ensure id is part of update
  deleteClass: (classroomId: string) => Promise<Classroom | void>

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
  getClassExamResults: (
    classroomId: string
  ) => Promise<ClassStudentExamResult[]>
  exportStudentsExcel: (selectedStudentIds: string[]) => Promise<{
    success: boolean
    outputPath?: string
    error?: string
  }>
  exportClassesExcel: (selectedClassroomIds: string[]) => Promise<{
    success: boolean
    outputPath?: string
    error?: string
  }>

  // Student Class Membership related
  createStudentClassroomMembership: (
    membershipData: Prisma.StudentClassroomMembershipCreateInput
  ) => Promise<StudentClassroomMembershipWithDetails>
  updateStudentClassroomMembership: (
    id: string,
    membershipData: Prisma.StudentClassroomMembershipUpdateInput
  ) => Promise<StudentClassroomMembershipWithDetails>
  deleteStudentClassroomMembership: (id: string) => Promise<void>
  getCurrentMembershipsByStudentId: (
    studentId: string
  ) => Promise<StudentClassroomMembershipWithDetails[]>
  getAllMembershipsByStudentId: (
    studentId: string
  ) => Promise<StudentClassroomMembershipWithDetails[]>
  getCurrentMembershipsByClassroomId: (
    classroomId: string
  ) => Promise<StudentClassroomMembershipWithDetails[]>
  addStudentToClass: (
    studentId: string,
    classroomId: string,
    startDate?: Date,
    attendanceNumber?: number,
    notes?: string
  ) => Promise<StudentClassroomMembershipWithDetails>
  endStudentMembership: (
    membershipId: string,
    endDate?: Date
  ) => Promise<StudentClassroomMembershipWithDetails>
  getMembershipsByDateRange: (
    startDate: Date,
    endDate?: Date
  ) => Promise<StudentClassroomMembershipWithDetails[]>
}
