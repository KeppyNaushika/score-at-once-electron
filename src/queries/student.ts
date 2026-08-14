import type { Prisma } from "@prisma/client"
import { queryOptions } from "@tanstack/react-query"

import { defineMutation } from "./defineMutation"

/**
 * 生徒（Student）・学級（Classroom）・在籍（StudentClassroomMembership）の読み書き。
 *
 * この3つは横断で使われる1つの集合で、学級の一覧には所属生徒が同梱される。
 *
 * 対応する preload は `electron-src/preload-apis/studentApi.ts`。
 */

// =====================================================================
// 取得
// =====================================================================

export const studentListQuery = () =>
  queryOptions({
    queryKey: ["students"] as const,
    queryFn: () => window.electronAPI.fetchStudents(),
  })

export const classroomListQuery = () =>
  queryOptions({
    queryKey: ["classrooms"] as const,
    queryFn: () => window.electronAPI.fetchClassrooms(),
  })

/** 生徒1人の試験結果（横断分析が読む） */
export const studentExamResultsQuery = (studentId: string) =>
  queryOptions({
    queryKey: ["studentExamResults", studentId] as const,
    queryFn: () => window.electronAPI.getStudentExamResults(studentId),
  })

/** 学級1つの試験結果（横断分析が読む） */
export const classroomExamResultsQuery = (classroomId: string) =>
  queryOptions({
    queryKey: ["classroomExamResults", classroomId] as const,
    queryFn: () => window.electronAPI.getClassroomExamResults(classroomId),
  })

// =====================================================================
// 書き込み
// =====================================================================

const studentsKey = studentListQuery().queryKey
const classroomsKey = classroomListQuery().queryKey

export const createStudentMutation = () =>
  defineMutation({
    mutationFn: (student: Prisma.StudentCreateInput) =>
      window.electronAPI.createStudent(student),
    meta: {
      invalidates: [studentsKey, classroomsKey],
      errorMessage: "生徒を作成できませんでした",
    },
  })

export const updateStudentMutation = () =>
  defineMutation({
    mutationFn: (input: { id: string; student: Prisma.StudentUpdateInput }) =>
      window.electronAPI.updateStudent(input.id, input.student),
    meta: {
      invalidates: [studentsKey, classroomsKey],
      errorMessage: "生徒を保存できませんでした",
    },
  })

export const deleteStudentMutation = () =>
  defineMutation({
    mutationFn: (studentId: string) =>
      window.electronAPI.deleteStudent(studentId),
    meta: {
      invalidates: [studentsKey, classroomsKey],
      errorMessage: "生徒を削除できませんでした",
    },
  })

export const createClassroomMutation = () =>
  defineMutation({
    mutationFn: (
      classroom: Parameters<typeof window.electronAPI.createClassroom>[0]
    ) => window.electronAPI.createClassroom(classroom),
    meta: {
      invalidates: [classroomsKey],
      errorMessage: "学級を作成できませんでした",
    },
  })

export const updateClassroomMutation = () =>
  defineMutation({
    mutationFn: (
      classroom: Parameters<typeof window.electronAPI.updateClassroom>[0]
    ) => window.electronAPI.updateClassroom(classroom),
    meta: {
      invalidates: [classroomsKey],
      errorMessage: "学級を保存できませんでした",
    },
  })

export const deleteClassroomMutation = () =>
  defineMutation({
    mutationFn: (classroomId: string) =>
      window.electronAPI.deleteClassroom(classroomId),
    meta: {
      invalidates: [classroomsKey, studentsKey],
      errorMessage: "学級を削除できませんでした",
    },
  })

// --- 在籍（StudentClassroomMembership）---

export const addStudentToClassroomMutation = () =>
  defineMutation({
    mutationFn: (input: {
      studentId: string
      classroomId: string
      startDate?: Date
      attendanceNumber?: number
      notes?: string
    }) =>
      window.electronAPI.addStudentToClassroom(
        input.studentId,
        input.classroomId,
        input.startDate,
        input.attendanceNumber,
        input.notes
      ),
    meta: {
      invalidates: [classroomsKey, studentsKey],
      errorMessage: "生徒を学級へ追加できませんでした",
    },
  })

export const updateStudentMembershipMutation = () =>
  defineMutation({
    mutationFn: (input: {
      id: string
      membership: Prisma.StudentClassroomMembershipUpdateInput
    }) =>
      window.electronAPI.updateStudentClassroomMembership(
        input.id,
        input.membership
      ),
    meta: {
      invalidates: [classroomsKey, studentsKey],
      errorMessage: "在籍を保存できませんでした",
    },
  })

export const deleteStudentMembershipMutation = () =>
  defineMutation({
    mutationFn: (membershipId: string) =>
      window.electronAPI.deleteStudentClassroomMembership(membershipId),
    meta: {
      invalidates: [classroomsKey, studentsKey],
      errorMessage: "在籍を削除できませんでした",
    },
  })

/** 在籍を終える（行は残り、終了日が入る） */
export const endStudentMembershipMutation = () =>
  defineMutation({
    mutationFn: (input: { membershipId: string; endDate?: Date }) =>
      window.electronAPI.endStudentMembership(
        input.membershipId,
        input.endDate
      ),
    meta: {
      invalidates: [classroomsKey, studentsKey],
      errorMessage: "在籍を終了できませんでした",
    },
  })

// =====================================================================
// DB を書かない操作
// =====================================================================

export const exportStudentsExcelMutation = () =>
  defineMutation({
    mutationFn: (selectedStudentIds: string[]) =>
      window.electronAPI.exportStudentsExcel(selectedStudentIds),
    meta: {
      writesDatabase: false,
      errorMessage: "生徒データを出力できませんでした",
    },
  })

export const exportClassroomsExcelMutation = () =>
  defineMutation({
    mutationFn: (selectedClassroomIds: string[]) =>
      window.electronAPI.exportClassroomsExcel(selectedClassroomIds),
    meta: {
      writesDatabase: false,
      errorMessage: "学級データを出力できませんでした",
    },
  })
