import { Prisma } from "@prisma/client"
import { ipcMain } from "electron"

import {
  addStudentsToExam,
  getClassesNotInExam,
  getStudentsForExam,
  getStudentsNotInExam,
  removeStudentsFromExam,
  updateStudentExamStatus,
  updateStudentOrders,
} from "../lib/prisma/examStudent"
import { checkGradingDataForStudents } from "../lib/prisma/gradingData"
import {
  createStudent,
  deleteStudent,
  fetchStudents,
  getStudentExamResults,
  updateStudent,
} from "../lib/prisma/student"
import {
  addStudentToClass,
  createStudentClassMembership,
  deleteStudentClassMembership,
  endStudentMembership,
  getAllMembershipsByStudentId,
  getCurrentMembershipsByClassId,
  getCurrentMembershipsByStudentId,
  getMembershipsByDateRange,
  updateStudentClassMembership,
} from "../lib/prisma/studentClassMembership"

export function setupStudentHandlers(): void {
  ipcMain.handle("fetch-students", async () => {
    try {
      return await fetchStudents()
    } catch (err) {
      console.error("Error fetching students:", err)
      throw err
    }
  })

  ipcMain.handle(
    "create-student",
    async (_event, studentData: Prisma.StudentCreateInput) => {
      try {
        return await createStudent(studentData)
      } catch (err) {
        console.error("Error creating student:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "update-student",
    async (_event, id: string, studentData: Prisma.StudentUpdateInput) => {
      try {
        return await updateStudent(id, studentData)
      } catch (err) {
        console.error("Error updating student:", err)
        throw err
      }
    }
  )

  ipcMain.handle("delete-student", async (_event, id: string) => {
    try {
      return await deleteStudent(id)
    } catch (err) {
      console.error("Error deleting student:", err)
      throw err
    }
  })

  // Student Class Membership handlers
  ipcMain.handle(
    "create-student-class-membership",
    async (
      _event,
      membershipData: Prisma.StudentClassMembershipCreateInput
    ) => {
      try {
        return await createStudentClassMembership(membershipData)
      } catch (err) {
        console.error("Error creating student class membership:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "update-student-class-membership",
    async (
      _event,
      id: string,
      membershipData: Prisma.StudentClassMembershipUpdateInput
    ) => {
      try {
        return await updateStudentClassMembership(id, membershipData)
      } catch (err) {
        console.error("Error updating student class membership:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "delete-student-class-membership",
    async (_event, id: string) => {
      try {
        return await deleteStudentClassMembership(id)
      } catch (err) {
        console.error("Error deleting student class membership:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "get-current-memberships-by-student-id",
    async (_event, studentId: string) => {
      try {
        return await getCurrentMembershipsByStudentId(studentId)
      } catch (err) {
        console.error("Error getting current memberships by student ID:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "get-all-memberships-by-student-id",
    async (_event, studentId: string) => {
      try {
        return await getAllMembershipsByStudentId(studentId)
      } catch (err) {
        console.error("Error getting all memberships by student ID:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "get-current-memberships-by-class-id",
    async (_event, classId: string) => {
      try {
        return await getCurrentMembershipsByClassId(classId)
      } catch (err) {
        console.error("Error getting current memberships by class ID:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "add-student-to-class",
    async (
      _event,
      studentId: string,
      classId: string,
      startDate?: Date,
      attendanceNumber?: number,
      notes?: string
    ) => {
      try {
        const dateToUse = startDate ? new Date(startDate) : new Date()

        const result = await addStudentToClass(
          studentId,
          classId,
          dateToUse,
          attendanceNumber,
          notes
        )
        return result
      } catch (err) {
        console.error("Error adding student to class:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "end-student-membership",
    async (_event, membershipId: string, endDate?: Date) => {
      try {
        return await endStudentMembership(membershipId, endDate)
      } catch (err) {
        console.error("Error ending student membership:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "get-memberships-by-date-range",
    async (_event, startDate: Date, endDate?: Date) => {
      try {
        return await getMembershipsByDateRange(startDate, endDate)
      } catch (err) {
        console.error("Error getting memberships by date range:", err)
        throw err
      }
    }
  )

  // Exam-Student relationship handlers
  ipcMain.handle("get-students-for-exam", async (_event, examId: string) => {
    try {
      return await getStudentsForExam(examId)
    } catch (err) {
      console.error("Error getting students for exam:", err)
      throw err
    }
  })

  ipcMain.handle(
    "add-students-to-exam",
    async (_event, examId: string, studentIds: string[]) => {
      try {
        return await addStudentsToExam(examId, studentIds)
      } catch (err) {
        console.error("Error adding students to exam:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "remove-students-from-exam",
    async (_event, examId: string, studentIds: string[]) => {
      try {
        return await removeStudentsFromExam(examId, studentIds)
      } catch (err) {
        console.error("Error removing students from exam:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "update-student-exam-status",
    async (
      _event,
      examId: string,
      studentId: string,
      status: "participating" | "expected" | "absent"
    ) => {
      try {
        return await updateStudentExamStatus(examId, studentId, status)
      } catch (err) {
        console.error("Error updating student exam status:", err)
        throw err
      }
    }
  )

  ipcMain.handle("get-classes-not-in-exam", async (_event, examId: string) => {
    try {
      return await getClassesNotInExam(examId)
    } catch (err) {
      console.error("Error getting classes not in exam:", err)
      throw err
    }
  })

  ipcMain.handle("get-students-not-in-exam", async (_event, examId: string) => {
    try {
      return await getStudentsNotInExam(examId)
    } catch (err) {
      console.error("Error getting students not in exam:", err)
      throw err
    }
  })

  ipcMain.handle(
    "check-grading-data-for-students",
    async (_event, examId: string, studentIds: string[]) => {
      try {
        const result = await checkGradingDataForStudents(examId, studentIds)
        return { success: true, ...result }
      } catch (err) {
        console.error("Error checking grading data for students:", err)
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        }
      }
    }
  )

  ipcMain.handle(
    "update-student-orders",
    async (
      _event,
      examId: string,
      studentOrders: { studentId: string; customOrder: number }[]
    ) => {
      try {
        return await updateStudentOrders(examId, studentOrders)
      } catch (err) {
        console.error("Error updating student orders:", err)
        throw err
      }
    }
  )

  ipcMain.handle(
    "get-student-exam-results",
    async (_event, studentId: string) => {
      try {
        return await getStudentExamResults(studentId)
      } catch (err) {
        console.error("Error getting student exam results:", err)
        throw err
      }
    }
  )
}
