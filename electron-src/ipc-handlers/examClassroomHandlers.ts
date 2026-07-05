import {
  addExamClassroom,
  AddExamClassroomOptions,
  addStudentsFromClass,
  getAdministeredClasses,
  getAvailableClassesForExam,
  getExamClassrooms,
  removeExamClassroom,
  removeExamClassroomByIds,
  reorderExamClassrooms,
  ReorderExamClassroomsOptions,
  updateExamClassroom,
  UpdateExamClassroomOptions,
} from "../lib/prisma/examClassroom"
import { registerHandler } from "./ipcHandlerUtils"

/** 試験と学級の関連付け（ExamClassroom）に関するIPCチャンネルを登録する */
export function setupExamClassroomHandlers(): void {
  // Get all classes for a exam
  registerHandler("exam-class:get-all", async (examId: string) => {
    return await getExamClassrooms(examId)
  })

  // Get administered classes (for adding students)
  registerHandler("exam-class:get-administered", async (examId: string) => {
    return await getAdministeredClasses(examId)
  })

  // Add a class to a exam
  registerHandler(
    "exam-class:add",
    async (options: AddExamClassroomOptions) => {
      return await addExamClassroom(options)
    }
  )

  // Update a exam class
  registerHandler(
    "exam-class:update",
    async (options: UpdateExamClassroomOptions) => {
      return await updateExamClassroom(options)
    }
  )

  // Remove a exam class by id
  registerHandler("exam-class:remove", async (id: string) => {
    return await removeExamClassroom(id)
  })

  // Remove a exam class by examId and classroomId
  registerHandler(
    "exam-class:remove-by-ids",
    async (examId: string, classroomId: string) => {
      return await removeExamClassroomByIds(examId, classroomId)
    }
  )

  // Get available classes (not yet in ExamClassroom)
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

  // Reorder exam classes
  registerHandler(
    "exam-class:reorder",
    async (options: ReorderExamClassroomsOptions) => {
      return await reorderExamClassrooms(options)
    }
  )
}
