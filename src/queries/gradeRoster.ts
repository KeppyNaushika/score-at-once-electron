import { queryOptions } from "@tanstack/react-query"

import type { ConfirmedDeletionCount } from "@/types/deletionConfirmation.types"

import { defineMutation } from "./defineMutation"
import { gradeScope } from "./grade"
import { scopeKeys } from "./keys"

/**
 * 成績算出の名簿（対象の学級・生徒と、その並び）の読み書き。
 *
 * 対応する preload は `electron-src/preload-apis/gradeApi.ts`。
 */

/** その成績の対象者1件（生徒と所属を同梱） */
export type GradeStudentRow = Awaited<
  ReturnType<typeof window.electronAPI.grade.getStudents>
>[number]

/** その成績の対象者（GradeStudent） */
export const gradeStudentsQuery = (gradeId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.grade(gradeId), "students"] as const,
    queryFn: () => window.electronAPI.grade.getStudents(gradeId),
  })

/** その成績に紐づく学級1件 */
export type GradeClassroomRow = Awaited<
  ReturnType<typeof window.electronAPI.grade.getClassrooms>
>[number]

/** その成績に紐づく学級 */
export const gradeClassroomsQuery = (gradeId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.grade(gradeId), "classrooms"] as const,
    queryFn: () => window.electronAPI.grade.getClassrooms(gradeId),
  })

/** まだ追加していない学級 */
export const gradeAvailableClassroomsQuery = (
  gradeId: string,
  activeOnly: boolean
) =>
  queryOptions({
    queryKey: [
      ...scopeKeys.grade(gradeId),
      "availableClassrooms",
      activeOnly,
    ] as const,
    queryFn: () =>
      window.electronAPI.grade.getAvailableClassrooms(gradeId, activeOnly),
  })

/** まだ追加していない生徒 */
export const gradeAvailableStudentsQuery = (
  gradeId: string,
  activeOnly: boolean
) =>
  queryOptions({
    queryKey: [
      ...scopeKeys.grade(gradeId),
      "availableStudents",
      activeOnly,
    ] as const,
    queryFn: () =>
      window.electronAPI.grade.getAvailableStudents(gradeId, activeOnly),
  })

export const addStudentsToGradeMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (studentIds: string[]) =>
      window.electronAPI.grade.addStudentsToGrade(gradeId, studentIds),
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "生徒を追加できませんでした",
    },
  })

export const addStudentsFromClassroomMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: { classroomId: string; activeOnly?: boolean }) =>
      window.electronAPI.grade.addStudentsFromClassroom(
        gradeId,
        input.classroomId,
        input.activeOnly
      ),
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "学級を追加できませんでした",
    },
  })

export const removeGradeClassroomMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: {
      classroomId: string
      removeStudents: boolean
      /** 利用者が確認ダイアログで見た件数（消す直前に main が数え直す。段階26） */
      confirmedCounts: ConfirmedDeletionCount[]
    }) =>
      window.electronAPI.grade.removeClassroom(
        gradeId,
        input.classroomId,
        input.removeStudents,
        input.confirmedCounts
      ),
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "学級を削除できませんでした",
    },
  })

export const setGradeClassroomOrdersMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (orderedClassroomIds: string[]) =>
      window.electronAPI.grade.setClassroomOrders(gradeId, orderedClassroomIds),
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "学級の並び順を保存できませんでした",
    },
  })

export const updateGradeStudentOrdersMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (studentOrders: { studentId: string; customOrder: number }[]) =>
      window.electronAPI.grade.updateStudentOrders(gradeId, studentOrders),
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "生徒の並び順を保存できませんでした",
    },
  })

/** 学級を外したときに何が消えるかの下見。DB は変えない */
export const previewGradeClassroomRemovalMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (classroomId: string) =>
      window.electronAPI.grade.classroomRemovalPreview(gradeId, classroomId),
    meta: {
      writesDatabase: false,
      errorMessage: "学級の削除内容を確認できませんでした",
    },
  })
