import { ipcMain } from "electron"

import {
  addExamClass,
  AddExamClassOptions,
  addStudentsFromClass,
  getAdministeredClasses,
  getAvailableClassesForExam,
  getExamClasses,
  getStatisticsClasses,
  getStudentClassInfo,
  getStudentClassInfoForExam,
  removeExamClass,
  removeExamClassByIds,
  reorderExamClasses,
  ReorderExamClassesOptions,
  updateExamClass,
  UpdateExamClassOptions,
} from "../lib/prisma/examClass"

export function setupExamClassHandlers(): void {
  // Get all classes for a exam
  ipcMain.handle("exam-class:get-all", async (_event, examId: string) => {
    try {
      return await getExamClasses(examId)
    } catch (error) {
      console.error("IPC exam-class:get-all error:", error)
      throw error
    }
  })

  // Get administered classes (for adding students)
  ipcMain.handle(
    "exam-class:get-administered",
    async (_event, examId: string) => {
      try {
        return await getAdministeredClasses(examId)
      } catch (error) {
        console.error("IPC exam-class:get-administered error:", error)
        throw error
      }
    }
  )

  // Get statistics classes (for aggregation)
  ipcMain.handle(
    "exam-class:get-statistics",
    async (_event, examId: string) => {
      try {
        return await getStatisticsClasses(examId)
      } catch (error) {
        console.error("IPC exam-class:get-statistics error:", error)
        throw error
      }
    }
  )

  // Add a class to a exam
  ipcMain.handle(
    "exam-class:add",
    async (_event, options: AddExamClassOptions) => {
      try {
        return await addExamClass(options)
      } catch (error) {
        console.error("IPC exam-class:add error:", error)
        throw error
      }
    }
  )

  // Update a exam class
  ipcMain.handle(
    "exam-class:update",
    async (_event, options: UpdateExamClassOptions) => {
      try {
        return await updateExamClass(options)
      } catch (error) {
        console.error("IPC exam-class:update error:", error)
        throw error
      }
    }
  )

  // Remove a exam class by id
  ipcMain.handle("exam-class:remove", async (_event, id: string) => {
    try {
      return await removeExamClass(id)
    } catch (error) {
      console.error("IPC exam-class:remove error:", error)
      throw error
    }
  })

  // Remove a exam class by examId and classId
  ipcMain.handle(
    "exam-class:remove-by-ids",
    async (_event, examId: string, classId: string) => {
      try {
        return await removeExamClassByIds(examId, classId)
      } catch (error) {
        console.error("IPC exam-class:remove-by-ids error:", error)
        throw error
      }
    }
  )

  // Get available classes (not yet in ExamClass)
  ipcMain.handle("exam-class:get-available", async (_event, examId: string) => {
    try {
      return await getAvailableClassesForExam(examId)
    } catch (error) {
      console.error("IPC exam-class:get-available error:", error)
      throw error
    }
  })

  // Add students from class (B案: 統合型フロー)
  ipcMain.handle(
    "exam-class:add-students-from-class",
    async (_event, examId: string, classId: string) => {
      try {
        return await addStudentsFromClass(examId, classId)
      } catch (error) {
        console.error("IPC exam-class:add-students-from-class error:", error)
        throw error
      }
    }
  )

  // Get class info for all students in a exam
  ipcMain.handle(
    "exam-class:get-student-class-info",
    async (_event, examId: string) => {
      try {
        return await getStudentClassInfoForExam(examId)
      } catch (error) {
        console.error("IPC exam-class:get-student-class-info error:", error)
        throw error
      }
    }
  )

  // Get class info for a single student
  ipcMain.handle(
    "exam-class:get-student-class-info-single",
    async (_event, examId: string, studentId: string) => {
      try {
        return await getStudentClassInfo(examId, studentId)
      } catch (error) {
        console.error(
          "IPC exam-class:get-student-class-info-single error:",
          error
        )
        throw error
      }
    }
  )

  // Reorder exam classes
  ipcMain.handle(
    "exam-class:reorder",
    async (_event, options: ReorderExamClassesOptions) => {
      try {
        return await reorderExamClasses(options)
      } catch (error) {
        console.error("IPC exam-class:reorder error:", error)
        throw error
      }
    }
  )
}
