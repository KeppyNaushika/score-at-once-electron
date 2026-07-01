import {
  addExamClass,
  AddExamClassOptions,
  addStudentsFromClass,
  getAdministeredClasses,
  getAvailableClassesForExam,
  getExamClasses,
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

/** 試験と学級の関連付け（ExamClass）に関するIPCチャンネルを登録する */
export function setupExamClassHandlers(): void {
  // Get all classes for a exam
  registerHandler("exam-class:get-all", async (examId: string) => {
    return await getExamClasses(examId)
  })

  // Get administered classes (for adding students)
  registerHandler("exam-class:get-administered", async (examId: string) => {
    return await getAdministeredClasses(examId)
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

  // Remove a exam class by examId and classroomId
  registerHandler(
    "exam-class:remove-by-ids",
    async (examId: string, classroomId: string) => {
      return await removeExamClassByIds(examId, classroomId)
    }
  )

  // Get available classes (not yet in ExamClass)
  registerHandler("exam-class:get-available", async (examId: string) => {
    return await getAvailableClassesForExam(examId)
  })

  // Add students from class (B案: 統合型フロー)
  registerHandler(
    "exam-class:add-students-from-class",
    async (examId: string, classroomId: string, activeOnly = true) => {
      return await addStudentsFromClass(examId, classroomId, activeOnly)
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
