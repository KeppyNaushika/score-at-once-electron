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
    exportStudentsExcel: (selectedStudentIds: string[]) =>
      ipcRenderer.invoke(
        "export-students-excel",
        selectedStudentIds
      ) as Promise<{
        success: boolean
        outputPath?: string
        error?: string
      }>,

    // Class related
    fetchClasses: () => ipcRenderer.invoke("fetch-classes"),
    createClass: (classData: Prisma.ClassCreateInput) =>
      ipcRenderer.invoke("create-class", classData),
    updateClass: (classData: Prisma.ClassUpdateInput & { id: string }) =>
      ipcRenderer.invoke("update-class", classData),
    deleteClass: (classId: string) =>
      ipcRenderer.invoke("delete-class", classId),
    exportClassesExcel: (selectedClassIds: string[]) =>
      ipcRenderer.invoke("export-classes-excel", selectedClassIds) as Promise<{
        success: boolean
        outputPath?: string
        error?: string
      }>,

    // Student Class Membership related
    createStudentClassMembership: (
      membershipData: Prisma.StudentClassMembershipCreateInput
    ) => ipcRenderer.invoke("create-student-class-membership", membershipData),
    updateStudentClassMembership: (
      id: string,
      membershipData: Prisma.StudentClassMembershipUpdateInput
    ) =>
      ipcRenderer.invoke("update-student-class-membership", id, membershipData),
    deleteStudentClassMembership: (id: string) =>
      ipcRenderer.invoke("delete-student-class-membership", id),
    getCurrentMembershipsByStudentId: (studentId: string) =>
      ipcRenderer.invoke("get-current-memberships-by-student-id", studentId),
    getAllMembershipsByStudentId: (studentId: string) =>
      ipcRenderer.invoke("get-all-memberships-by-student-id", studentId),
    getCurrentMembershipsByClassId: (classId: string) =>
      ipcRenderer.invoke("get-current-memberships-by-class-id", classId),
    addStudentToClass: (
      studentId: string,
      classId: string,
      startDate?: Date,
      attendanceNumber?: number,
      notes?: string
    ) =>
      ipcRenderer.invoke(
        "add-student-to-class",
        studentId,
        classId,
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
