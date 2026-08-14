import type { Prisma } from "@prisma/client"
import { queryOptions } from "@tanstack/react-query"

import type { ExamStudentStatus } from "@/types/examStudentStatus.types"
import type { CreateExamArgs } from "@/types/prismaExtensions"

import { defineMutation } from "./defineMutation"
import { scopeKeys } from "./keys"

/**
 * 試験（Exam）本体・模範解答ページ・受験生徒の読み書き。
 *
 * 対応する preload は `electron-src/preload-apis/examApi.ts`。
 * 採点領域・小計点・採点結果・手書きは別ファイル（`cropRegion.ts` など）が持つ。
 */

// =====================================================================
// 取得
// =====================================================================

/** 一覧に出す試験の要約（利用者ごとに見えるものが違う） */
export const examListQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["exam", "list", userId] as const,
    queryFn: () => window.electronAPI.fetchExamsSummary(userId ?? ""),
  })

/** 試験1件そのもの（パンくず・答案アップロードなど、本体だけ要る画面） */
export const examDetailQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "detail"] as const,
    queryFn: () => window.electronAPI.getExam(examId),
  })

/** 試験＋模範解答ページ（採点画面が1回で取る形） */
export const examWithPagesQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "withPages"] as const,
    queryFn: () => window.electronAPI.getExamWithPages(examId),
  })

/** 試験の模範解答ページ */
export const examPagesQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "pages"] as const,
    queryFn: () => window.electronAPI.getExamPagesByExamId(examId),
  })

/** 模範解答の画像 */
export const masterImagesQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "masterImages"] as const,
    queryFn: () => window.electronAPI.getMasterImagesByExamId(examId),
  })

/** 受験者の答案画像 */
export const studentAnswerImagesQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "studentAnswerImages"] as const,
    queryFn: () => window.electronAPI.getStudentAnswerImagesByExamId(examId),
  })

/** その試験の受験生徒 */
export const examStudentsQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "students"] as const,
    queryFn: () => window.electronAPI.getStudentsForExam(examId),
  })

/** まだ入れていない学級 */
export const classroomsNotInExamQuery = (examId: string, activeOnly: boolean) =>
  queryOptions({
    queryKey: [
      ...scopeKeys.exam(examId),
      "classroomsNotIn",
      activeOnly,
    ] as const,
    queryFn: () =>
      window.electronAPI.getClassroomsNotInExam(examId, activeOnly),
  })

/** まだ入れていない生徒 */
export const studentsNotInExamQuery = (examId: string, activeOnly: boolean) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "studentsNotIn", activeOnly] as const,
    queryFn: () => window.electronAPI.getStudentsNotInExam(examId, activeOnly),
  })

// =====================================================================
// 書き込み
// =====================================================================

const examScope = (examId: string) => scopeKeys.exam(examId)

export const createExamMutation = (userId: string | undefined) =>
  defineMutation({
    mutationFn: (props: CreateExamArgs) =>
      window.electronAPI.createExam(props, userId ?? ""),
    meta: {
      invalidates: [examListQuery(userId).queryKey],
      errorMessage: "試験を作成できませんでした",
    },
  })

export const updateExamMutation = (
  examId: string,
  userId: string | undefined
) =>
  defineMutation({
    mutationFn: (data: Prisma.ExamUpdateInput) =>
      window.electronAPI.updateExam(examId, data),
    meta: {
      invalidates: [examScope(examId), examListQuery(userId).queryKey],
      errorMessage: "試験を保存できませんでした",
    },
  })

export const deleteExamMutation = (userId: string | undefined) =>
  defineMutation({
    mutationFn: (examId: string) => window.electronAPI.deleteExam(examId),
    meta: {
      invalidates: [examListQuery(userId).queryKey],
      errorMessage: "試験を削除できませんでした",
    },
  })

// --- 模範解答ページ ---

export const uploadMasterAnswersMutation = (examId: string) =>
  defineMutation({
    mutationFn: (
      files: Parameters<typeof window.electronAPI.uploadMasterAnswers>[1]
    ) => window.electronAPI.uploadMasterAnswers(examId, files),
    meta: {
      invalidates: [examScope(examId)],
      errorMessage: "模範解答を取り込めませんでした",
    },
  })

export const replaceMasterAnswerImageMutation = (examId: string) =>
  defineMutation({
    mutationFn: (input: {
      examPageId: string
      fileData: Parameters<
        typeof window.electronAPI.replaceMasterAnswerImage
      >[1]
    }) =>
      window.electronAPI.replaceMasterAnswerImage(
        input.examPageId,
        input.fileData
      ),
    meta: {
      invalidates: [examScope(examId)],
      errorMessage: "模範解答を差し替えられませんでした",
    },
  })

export const deleteMasterAnswerMutation = (examId: string) =>
  defineMutation({
    mutationFn: (examPageId: string) =>
      window.electronAPI.deleteMasterAnswer(examPageId),
    meta: {
      invalidates: [examScope(examId)],
      errorMessage: "模範解答を削除できませんでした",
    },
  })

export const updateMasterAnswersOrderMutation = (examId: string) =>
  defineMutation({
    mutationFn: (
      orders: Parameters<typeof window.electronAPI.updateMasterAnswersOrder>[0]
    ) => window.electronAPI.updateMasterAnswersOrder(orders),
    meta: {
      invalidates: [examScope(examId)],
      errorMessage: "模範解答の並び順を保存できませんでした",
    },
  })

export const updateExamPagePageSizeMutation = (examId: string) =>
  defineMutation({
    mutationFn: (input: { examPageId: string; pageSize: string }) =>
      window.electronAPI.updateExamPagePageSize(
        input.examPageId,
        input.pageSize
      ),
    meta: {
      invalidates: [examScope(examId)],
      errorMessage: "用紙サイズを保存できませんでした",
    },
  })

// --- 受験生徒 ---

export const addStudentsToExamMutation = (examId: string) =>
  defineMutation({
    mutationFn: (studentIds: string[]) =>
      window.electronAPI.addStudentsToExam(examId, studentIds),
    meta: {
      invalidates: [examScope(examId)],
      errorMessage: "受験生徒を追加できませんでした",
    },
  })

export const removeStudentsFromExamMutation = (examId: string) =>
  defineMutation({
    mutationFn: (studentIds: string[]) =>
      window.electronAPI.removeStudentsFromExam(examId, studentIds),
    meta: {
      invalidates: [examScope(examId)],
      errorMessage: "受験生徒を外せませんでした",
    },
  })

export const updateStudentExamStatusMutation = (examId: string) =>
  defineMutation({
    mutationFn: (input: { studentId: string; status: ExamStudentStatus }) =>
      window.electronAPI.updateStudentExamStatus(
        examId,
        input.studentId,
        input.status
      ),
    scope: { id: `exam:${examId}:studentStatus` },
    meta: {
      invalidates: [examScope(examId)],
      errorMessage: "受験状態を保存できませんでした",
    },
  })

export const updateExamStudentOrdersMutation = (examId: string) =>
  defineMutation({
    mutationFn: (studentOrders: { studentId: string; customOrder: number }[]) =>
      window.electronAPI.updateStudentOrders(examId, studentOrders),
    meta: {
      invalidates: [examScope(examId)],
      errorMessage: "受験生徒の並び順を保存できませんでした",
    },
  })

// =====================================================================
// DB を書かない操作
// =====================================================================

/** 外す前に、その生徒の採点データが残るかを見る。DB は変えない */
export const checkGradingDataForStudentsMutation = (examId: string) =>
  defineMutation({
    mutationFn: (studentIds: string[]) =>
      window.electronAPI.checkGradingDataForStudents(examId, studentIds),
    meta: {
      writesDatabase: false,
      errorMessage: "採点データを確認できませんでした",
    },
  })
