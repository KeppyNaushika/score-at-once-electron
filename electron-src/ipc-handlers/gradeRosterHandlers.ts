/**
 * 成績算出の名簿（対象の学級・生徒）の IPC ハンドラー
 */

import type { ConfirmedDeletionCount } from "../../src/types/deletionConfirmation.types"
import {
  addStudentsFromClassroomToGrade,
  addStudentsToGrade,
  getAvailableClassroomsForGrade,
  getAvailableStudentsForGrade,
  getGradeClassroomRemovalPreview,
  getGradeClassrooms,
  getStudentsByGradeId,
  removeClassroomFromGrade,
  setGradeClassroomOrders,
  updateGradeStudentOrders,
} from "../lib/prisma/gradeStudent"
import { type HandlerMap } from "./ipcHandlerUtils"

/** 成績算出の名簿（学級・生徒の追加・解除・並び）の IPC チャンネル */
export const gradeRosterHandlers = {
  // =====================================================================
  // Grade 生徒・学級管理
  // =====================================================================

  "grade:getStudents": async (gradeId: string) => {
    return getStudentsByGradeId(gradeId)
  },

  "grade:getClassrooms": async (gradeId: string) => {
    return getGradeClassrooms(gradeId)
  },

  "grade:getAvailableClassrooms": async (
    gradeId: string,
    activeOnly: boolean = true
  ) => {
    return getAvailableClassroomsForGrade(gradeId, activeOnly)
  },

  "grade:getAvailableStudents": async (
    gradeId: string,
    activeOnly: boolean = true
  ) => {
    return getAvailableStudentsForGrade(gradeId, activeOnly)
  },

  "grade:addStudentsFromClassroom": async (
    gradeId: string,
    classroomId: string,
    activeOnly: boolean = true
  ) => {
    return addStudentsFromClassroomToGrade(gradeId, classroomId, activeOnly)
  },

  "grade:addStudentsToGrade": async (gradeId: string, studentIds: string[]) => {
    return addStudentsToGrade(gradeId, studentIds)
  },

  // 利用者が見た件数を添えて削除する（消す直前に数え直し、増えていれば中止する）
  "grade:removeClassroom": async (
    gradeId: string,
    classroomId: string,
    deleteStudents: boolean,
    confirmedCounts: ConfirmedDeletionCount[]
  ) => {
    return removeClassroomFromGrade(
      gradeId,
      classroomId,
      deleteStudents,
      confirmedCounts
    )
  },

  "grade:classroomRemovalPreview": async (
    gradeId: string,
    classroomId: string
  ) => {
    return getGradeClassroomRemovalPreview(gradeId, classroomId)
  },

  "grade:setClassroomOrders": async (
    gradeId: string,
    orderedClassroomIds: string[]
  ) => {
    return setGradeClassroomOrders(gradeId, orderedClassroomIds)
  },

  "grade:updateStudentOrders": async (
    gradeId: string,
    studentOrders: { studentId: string; customOrder: number }[]
  ) => {
    return updateGradeStudentOrders(gradeId, studentOrders)
  },
} satisfies HandlerMap
