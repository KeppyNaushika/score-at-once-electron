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
import { registerHandler } from "./ipcHandlerUtils"

export function setupExamClassHandlers(): void {
  // Get all classes for a exam
  registerHandler("exam-class:get-all", async (examId: string) => {
    return await getExamClasses(examId)
  })

  // Get administered classes (for adding students)
  registerHandler("exam-class:get-administered", async (examId: string) => {
    return await getAdministeredClasses(examId)
  })

  // Get statistics classes (for aggregation)
  registerHandler("exam-class:get-statistics", async (examId: string) => {
    return await getStatisticsClasses(examId)
  })

  // Add a class to a exam
  registerHandler("exam-class:add", async (options: AddExamClassOptions) => {
    return await addExamClass(options)
  })

  // Update a exam class
  registerHandler(
    "exam-class:update",
    async (options: UpdateExamClassOptions) => {
      return await updateExamClass(options)
    }
  )

  // Remove a exam class by id
  registerHandler("exam-class:remove", async (id: string) => {
    return await removeExamClass(id)
  })

  // Remove a exam class by examId and classId
  registerHandler(
    "exam-class:remove-by-ids",
    async (examId: string, classId: string) => {
      return await removeExamClassByIds(examId, classId)
    }
  )

  // Get available classes (not yet in ExamClass)
  registerHandler("exam-class:get-available", async (examId: string) => {
    return await getAvailableClassesForExam(examId)
  })

  // Add students from class (B案: 統合型フロー)
  registerHandler(
    "exam-class:add-students-from-class",
    async (examId: string, classId: string) => {
      return await addStudentsFromClass(examId, classId)
    }
  )

  // Get class info for all students in a exam
  registerHandler(
    "exam-class:get-student-class-info",
    async (examId: string) => {
      return await getStudentClassInfoForExam(examId)
    }
  )

  // Get class info for a single student
  registerHandler(
    "exam-class:get-student-class-info-single",
    async (examId: string, studentId: string) => {
      return await getStudentClassInfo(examId, studentId)
    }
  )

  // Reorder exam classes
  registerHandler(
    "exam-class:reorder",
    async (options: ReorderExamClassesOptions) => {
      return await reorderExamClasses(options)
    }
  )
}
