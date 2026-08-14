import { queryOptions } from "@tanstack/react-query"

import { defineMutation } from "./defineMutation"
import { scopeKeys } from "./keys"

/**
 * 試験の学級（ExamClassroom）の読み書き。
 *
 * 対応する preload は `electron-src/preload-apis/examClassroomApi.ts`。
 */

// =====================================================================
// 取得
// =====================================================================

/** 試験に紐づく学級1件 */
export type ExamClassroomRow = Awaited<
  ReturnType<typeof window.electronAPI.examClassroom.getAll>
>[number]

/** その試験に紐づく学級 */
export const examClassroomsQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "classrooms"] as const,
    queryFn: () => window.electronAPI.examClassroom.getAll(examId),
  })

/** 集計対象として選ばれている学級 */
export const administeredExamClassroomsQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "administeredClassrooms"] as const,
    queryFn: () => window.electronAPI.examClassroom.getAdministered(examId),
  })

/** まだ追加していない学級 */
export const availableExamClassroomsQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "availableClassrooms"] as const,
    queryFn: () => window.electronAPI.examClassroom.getAvailable(examId),
  })

// =====================================================================
// 書き込み
// =====================================================================

const examScope = (examId: string) => scopeKeys.exam(examId)

export const addExamClassroomMutation = (examId: string) =>
  defineMutation({
    mutationFn: (
      options: Parameters<typeof window.electronAPI.examClassroom.add>[0]
    ) => window.electronAPI.examClassroom.add(options),
    meta: {
      invalidates: [examScope(examId)],
      errorMessage: "学級を追加できませんでした",
    },
  })

export const updateExamClassroomMutation = (examId: string) =>
  defineMutation({
    mutationFn: (
      options: Parameters<typeof window.electronAPI.examClassroom.update>[0]
    ) => window.electronAPI.examClassroom.update(options),
    scope: { id: `exam:${examId}:classrooms` },
    meta: {
      invalidates: [examScope(examId)],
      errorMessage: "学級の設定を保存できませんでした",
    },
  })

export const removeExamClassroomMutation = (examId: string) =>
  defineMutation({
    mutationFn: (examClassroomId: string) =>
      window.electronAPI.examClassroom.remove(examClassroomId),
    meta: {
      invalidates: [examScope(examId)],
      errorMessage: "学級を外せませんでした",
    },
  })

export const reorderExamClassroomsMutation = (examId: string) =>
  defineMutation({
    mutationFn: (
      options: Parameters<typeof window.electronAPI.examClassroom.reorder>[0]
    ) => window.electronAPI.examClassroom.reorder(options),
    meta: {
      invalidates: [examScope(examId)],
      errorMessage: "学級の並び順を保存できませんでした",
    },
  })

export const addStudentsFromClassroomToExamMutation = (examId: string) =>
  defineMutation({
    mutationFn: (input: { classroomId: string; activeOnly?: boolean }) =>
      window.electronAPI.examClassroom.addStudentsFromClassroom(
        examId,
        input.classroomId,
        input.activeOnly
      ),
    meta: {
      invalidates: [examScope(examId)],
      errorMessage: "学級の生徒を追加できませんでした",
    },
  })
