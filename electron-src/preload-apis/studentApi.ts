import type { Prisma } from "@prisma/client"

import { invoke } from "./invoke"

/** 生徒・学級・所属管理のIPC API（生徒CRUD・学級CRUD・クラス所属・Excel出力） */
export function createStudentApi() {
  return {
    // Student related
    fetchStudents: () => invoke("fetch-students"),
    createStudent: (studentData: Prisma.StudentCreateInput) =>
      invoke("create-student", studentData),
    updateStudent: (id: string, studentData: Prisma.StudentUpdateInput) =>
      invoke("update-student", id, studentData),
    deleteStudent: (id: string) => invoke("delete-student", id),
    getStudentExamResults: (studentId: string) =>
      invoke("get-student-exam-results", studentId),
    getClassroomExamResults: (classroomId: string) =>
      invoke("get-class-exam-results", classroomId),
    exportStudentsExcel: (selectedStudentIds: string[]) =>
      invoke("export-students-excel", selectedStudentIds) as Promise<{
        success: boolean
        outputPath?: string
        error?: string
      }>,

    // Classroom related
    fetchClassrooms: () => invoke("fetch-classrooms"),
    createClassroom: (classroomData: Prisma.ClassroomCreateInput) =>
      invoke("create-class", classroomData),
    updateClassroom: (
      classroomData: Prisma.ClassroomUpdateInput & { id: string }
    ) => invoke("update-class", classroomData),
    deleteClassroom: (classroomId: string) =>
      invoke("delete-class", classroomId),
    exportClassroomsExcel: (selectedClassroomIds: string[]) =>
      invoke("export-classrooms-excel", selectedClassroomIds) as Promise<{
        success: boolean
        outputPath?: string
        error?: string
      }>,

    // Student Classroom Membership related
    updateStudentClassroomMembership: (
      id: string,
      membershipData: Prisma.StudentClassroomMembershipUpdateInput
    ) => invoke("update-student-class-membership", id, membershipData),
    deleteStudentClassroomMembership: (id: string) =>
      invoke("delete-student-class-membership", id),
    addStudentToClassroom: (
      studentId: string,
      classroomId: string,
      startDate?: Date,
      attendanceNumber?: number,
      notes?: string
    ) =>
      invoke(
        "add-student-to-class",
        studentId,
        classroomId,
        startDate,
        attendanceNumber,
        notes
      ),
    endStudentMembership: (membershipId: string, endDate?: Date) =>
      invoke("end-student-membership", membershipId, endDate),
  }
}
