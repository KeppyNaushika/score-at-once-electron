import { Prisma } from "@prisma/client"
import { ipcRenderer } from "electron"

/** 生徒・学級・所属管理のIPC API（生徒CRUD・学級CRUD・クラス所属・Excel出力） */
export function createStudentApi() {
  return {
    // Student related
    fetchStudents: () => ipcRenderer.invoke("fetch-students"),
    createStudent: (studentData: Prisma.StudentCreateInput) =>
      ipcRenderer.invoke("create-student", studentData),
    updateStudent: (id: string, studentData: Prisma.StudentUpdateInput) =>
      ipcRenderer.invoke("update-student", id, studentData),
    deleteStudent: (id: string) => ipcRenderer.invoke("delete-student", id),
    getStudentExamResults: (studentId: string) =>
      ipcRenderer.invoke("get-student-exam-results", studentId),
    getClassroomExamResults: (classroomId: string) =>
      ipcRenderer.invoke("get-class-exam-results", classroomId),
    exportStudentsExcel: (selectedStudentIds: string[]) =>
      ipcRenderer.invoke(
        "export-students-excel",
        selectedStudentIds
      ) as Promise<{
        success: boolean
        outputPath?: string
        error?: string
      }>,

    // Classroom related
    fetchClassrooms: () => ipcRenderer.invoke("fetch-classrooms"),
    createClassroom: (classroomData: Prisma.ClassroomCreateInput) =>
      ipcRenderer.invoke("create-class", classroomData),
    updateClassroom: (
      classroomData: Prisma.ClassroomUpdateInput & { id: string }
    ) => ipcRenderer.invoke("update-class", classroomData),
    deleteClassroom: (classroomId: string) =>
      ipcRenderer.invoke("delete-class", classroomId),
    exportClassroomsExcel: (selectedClassroomIds: string[]) =>
      ipcRenderer.invoke(
        "export-classrooms-excel",
        selectedClassroomIds
      ) as Promise<{
        success: boolean
        outputPath?: string
        error?: string
      }>,

    // Student Classroom Membership related
    createStudentClassroomMembership: (
      membershipData: Prisma.StudentClassroomMembershipCreateInput
    ) => ipcRenderer.invoke("create-student-class-membership", membershipData),
    updateStudentClassroomMembership: (
      id: string,
      membershipData: Prisma.StudentClassroomMembershipUpdateInput
    ) =>
      ipcRenderer.invoke("update-student-class-membership", id, membershipData),
    deleteStudentClassroomMembership: (id: string) =>
      ipcRenderer.invoke("delete-student-class-membership", id),
    getCurrentMembershipsByStudentId: (studentId: string) =>
      ipcRenderer.invoke("get-current-memberships-by-student-id", studentId),
    getAllMembershipsByStudentId: (studentId: string) =>
      ipcRenderer.invoke("get-all-memberships-by-student-id", studentId),
    getCurrentMembershipsByClassroomId: (classroomId: string) =>
      ipcRenderer.invoke("get-current-memberships-by-class-id", classroomId),
    addStudentToClassroom: (
      studentId: string,
      classroomId: string,
      startDate?: Date,
      attendanceNumber?: number,
      notes?: string
    ) =>
      ipcRenderer.invoke(
        "add-student-to-class",
        studentId,
        classroomId,
        startDate,
        attendanceNumber,
        notes
      ),
    endStudentMembership: (membershipId: string, endDate?: Date) =>
      ipcRenderer.invoke("end-student-membership", membershipId, endDate),
    getMembershipsByDateRange: (startDate: Date, endDate?: Date) =>
      ipcRenderer.invoke("get-memberships-by-date-range", startDate, endDate),
  }
}
