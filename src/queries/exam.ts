import type { Prisma } from "@prisma/client"
import { queryOptions } from "@tanstack/react-query"

import type { ConfirmedDeletionCount } from "@/types/deletionConfirmation.types"
import type { ExamStudentStatus } from "@/types/examStudentStatus.types"
import type { CreateExamArgs } from "@/types/prismaExtensions"

import { defineMutation } from "./defineMutation"
import { scopeKeys } from "./keys"
import { masterMarkersQuery } from "./omr"

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
export const examListQuery = (userId: string) =>
  queryOptions({
    queryKey: ["exam", "list", userId] as const,
    queryFn: () => window.electronAPI.fetchExamsSummary(userId),
  })

/** 試験1件そのもの（パンくず・答案アップロードなど、本体だけ要る画面） */
export const examDetailQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "detail"] as const,
    queryFn: () => window.electronAPI.getExam(examId),
  })

/**
 * 詳細画面が読む試験1件。
 *
 * 境界（`fetch-exam-by-id`）の戻り値から導く。手で書き写すと Decimal → number の
 * ような境界の変換に追随できない。
 */
export type ExamForDetail = NonNullable<
  Awaited<ReturnType<typeof window.electronAPI.fetchExamById>>
>

/**
 * 試験1件＋進捗の判定に使う関係（模範解答ページ・採点領域・答案画像）。
 *
 * 一覧（`fetch-exams-summary`）と同じ形を境界が返すので、進捗の計算は renderer の
 * `getExamProgress` 1本で足りる。
 */
export const examForDetailQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "forDetail"] as const,
    queryFn: () => window.electronAPI.fetchExamById(examId),
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

export const createExamMutation = (userId: string) =>
  defineMutation({
    mutationFn: (props: CreateExamArgs) =>
      window.electronAPI.createExam(props, userId),
    meta: {
      invalidates: [examListQuery(userId).queryKey],
      errorMessage: "試験を作成できませんでした",
    },
  })

export const updateExamMutation = (examId: string, userId: string) =>
  defineMutation({
    mutationFn: (data: Prisma.ExamUpdateInput) =>
      window.electronAPI.updateExam(examId, data),
    meta: {
      invalidates: [examScope(examId), examListQuery(userId).queryKey],
      errorMessage: "試験を保存できませんでした",
    },
  })

/**
 * 試験を削除する。**利用者が見た件数を添える** — main は消す直前に数え直し、
 * 増えていれば中止する（docs/remaining-work.md 段階26）。
 */
export const deleteExamMutation = (userId: string) =>
  defineMutation({
    mutationFn: ({
      examId,
      confirmedCounts,
    }: {
      examId: string
      confirmedCounts: ConfirmedDeletionCount[]
    }) => window.electronAPI.deleteExam(examId, confirmedCounts),
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
      // マーカー検出は試験のまとまりの外に置いてある（重いので、模範解答の画像が
      // 変わったときだけ解き直す）。名指しで取り直す
      invalidates: [examScope(examId), masterMarkersQuery(examId).queryKey],
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
      // マーカー検出は試験のまとまりの外に置いてある（重いので、模範解答の画像が
      // 変わったときだけ解き直す）。名指しで取り直す
      invalidates: [examScope(examId), masterMarkersQuery(examId).queryKey],
      errorMessage: "模範解答を差し替えられませんでした",
    },
  })

export const deleteMasterAnswerMutation = (examId: string) =>
  defineMutation({
    mutationFn: ({
      examPageId,
      confirmedCounts,
    }: {
      examPageId: string
      /** 利用者が確認ダイアログで見た件数（消す直前に main が数え直す。段階26） */
      confirmedCounts: ConfirmedDeletionCount[]
    }) => window.electronAPI.deleteMasterAnswer(examPageId, confirmedCounts),
    meta: {
      // マーカー検出は試験のまとまりの外に置いてある（重いので、模範解答の画像が
      // 変わったときだけ解き直す）。名指しで取り直す
      invalidates: [examScope(examId), masterMarkersQuery(examId).queryKey],
      errorMessage: "模範解答を削除できませんでした",
    },
  })

/**
 * 模範解答ページを1つ隣へ動かす。
 *
 * 運ぶのは「どのページをどちらへ」だけ。全ページの絶対 `pageNumber` を送ると、
 * 他の教員が先に動かした結果まで踏み潰す。
 */
export const moveExamPageMutation = (examId: string) =>
  defineMutation({
    mutationFn: (input: { examPageId: string; direction: "left" | "right" }) =>
      window.electronAPI.moveExamPage(input.examPageId, input.direction),
    scope: { id: `exam:${examId}:examPageOrder` },
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

/**
 * 受験生徒を試験から外す。**利用者が見た件数を添える** — main は消す直前に
 * 数え直し、増えていれば中止する（docs/remaining-work.md 段階26）。
 */
export const removeStudentsFromExamMutation = (examId: string) =>
  defineMutation({
    mutationFn: ({
      studentIds,
      confirmedCounts,
    }: {
      studentIds: string[]
      confirmedCounts: ConfirmedDeletionCount[]
    }) =>
      window.electronAPI.removeStudentsFromExam(
        examId,
        studentIds,
        confirmedCounts
      ),
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

/** 外す前に、巻き添えになる採点データを数える。DB は変えない */
export const examStudentDeletionCountsMutation = (examId: string) =>
  defineMutation({
    mutationFn: (studentIds: string[]) =>
      window.electronAPI.getExamStudentDeletionCounts(examId, studentIds),
    meta: {
      writesDatabase: false,
      errorMessage: "採点データを確認できませんでした",
    },
  })
