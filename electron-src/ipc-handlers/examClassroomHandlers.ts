import type {
  AddExamClassroomOptions,
  ReorderExamClassroomsOptions,
  UpdateExamClassroomOptions,
} from "../lib/prisma/examClassroom"
import {
  addExamClassroom,
  addStudentsFromClassroom,
  getAdministeredClassrooms,
  getAvailableClassroomsForExam,
  getExamClassrooms,
  removeExamClassroom,
  reorderExamClassrooms,
  updateExamClassroom,
} from "../lib/prisma/examClassroom"
import { type HandlerMap } from "./ipcHandlerUtils"

/** 試験と学級の関連付け（ExamClassroom）に関するIPCチャンネルを登録する */
export const examClassroomHandlers = {
  // Get all classrooms for a exam
  "exam-class:get-all": async (examId: string) => {
    return await getExamClassrooms(examId)
  },

  // Get administered classrooms (for adding students)
  "exam-class:get-administered": async (examId: string) => {
    return await getAdministeredClassrooms(examId)
  },

  // Add a class to a exam
  "exam-class:add": async (options: AddExamClassroomOptions) => {
    return await addExamClassroom(options)
  },

  // Update a exam class
  "exam-class:update": async (options: UpdateExamClassroomOptions) => {
    return await updateExamClassroom(options)
  },

  // Remove a exam class by id
  "exam-class:remove": async (id: string) => {
    return await removeExamClassroom(id)
  },

  // Get available classrooms (not yet in ExamClassroom)
  "exam-class:get-available": async (examId: string) => {
    return await getAvailableClassroomsForExam(examId)
  },

  // Add students from class (B案: 統合型フロー)
  "exam-class:add-students-from-class": async (
    examId: string,
    classroomId: string,
    activeOnly: boolean = true
  ) => {
    return await addStudentsFromClassroom(examId, classroomId, activeOnly)
  },

  // Reorder exam classrooms
  "exam-class:reorder": async (options: ReorderExamClassroomsOptions) => {
    return await reorderExamClassrooms(options)
  },
} satisfies HandlerMap
