import type { Classroom, Prisma, Student } from "@prisma/client"

import type {
  ClassroomStudentExamResult,
  StudentExamResult,
} from "@/electron-src/lib/prisma/student"

import type {
  ClassroomWithMemberships,
  StudentClassroomMembershipWithStudentAndClassroom,
  StudentWithMemberships,
} from "../prismaExtensions"

/**
 * 学級・生徒・所属関連API
 */
export interface ClassroomStudentAPI {
  // Classroom related
  fetchClassrooms: () => Promise<ClassroomWithMemberships[]>
  getClassroomsNotInExam: (
    examId: string,
    activeOnly?: boolean
  ) => Promise<
    Array<{
      id: string
      name: string
      classroomCode: string | null
      grade: number | null
      studentCount: number
      studentNames: string[]
    }>
  >
  getStudentsNotInExam: (
    examId: string,
    activeOnly?: boolean
  ) => Promise<StudentWithMemberships[]>
  createClassroom: (
    classroomData: Prisma.ClassroomCreateWithoutTeachersInput
  ) => Promise<ClassroomWithMemberships>
  updateClassroom: (
    classroomData: Prisma.ClassroomUpdateInput & { id: string }
  ) => Promise<ClassroomWithMemberships> // Ensure id is part of update
  deleteClassroom: (classroomId: string) => Promise<Classroom | void>

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
  getClassroomExamResults: (
    classroomId: string
  ) => Promise<ClassroomStudentExamResult[]>
  /** 保存先を選ばずに閉じた場合は canceled で返る（失敗ではない） */
  exportStudentsExcel: (
    selectedStudentIds: string[]
  ) => Promise<{ canceled: true } | { canceled: false; outputPath: string }>
  exportClassroomsExcel: (
    selectedClassroomIds: string[]
  ) => Promise<{ canceled: true } | { canceled: false; outputPath: string }>

  // Student Classroom Membership related
  updateStudentClassroomMembership: (
    id: string,
    membershipData: Prisma.StudentClassroomMembershipUpdateInput
  ) => Promise<StudentClassroomMembershipWithStudentAndClassroom>
  deleteStudentClassroomMembership: (id: string) => Promise<void>
  addStudentToClassroom: (
    studentId: string,
    classroomId: string,
    startDate?: Date,
    attendanceNumber?: number,
    notes?: string
  ) => Promise<StudentClassroomMembershipWithStudentAndClassroom>
  endStudentMembership: (
    membershipId: string,
    endDate?: Date
  ) => Promise<StudentClassroomMembershipWithStudentAndClassroom>
}
