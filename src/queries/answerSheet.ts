import { queryOptions } from "@tanstack/react-query"

import { defineMutation } from "./defineMutation"
import { scopeKeys } from "./keys"

/**
 * 生徒答案（StudentAnswerImage）の読み書き。
 *
 * 対応する preload は `electron-src/preload-apis/answerSheetApi.ts`。
 */

// =====================================================================
// 取得
// =====================================================================

/** 答案管理(06)が読む形（受験生徒＋模範解答ページ＋配置済みの答案） */
export const studentAnswersDatasetQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "studentAnswersDataset"] as const,
    queryFn: () => window.electronAPI.getStudentAnswersDataset(examId),
  })

/** 答案1枚に載っている採点結果の要約（削除確認で読む） */
export const studentAnswerScoreSummaryQuery = (studentAnswerImageId: string) =>
  queryOptions({
    queryKey: [
      "studentAnswerImage",
      studentAnswerImageId,
      "scoreSummary",
    ] as const,
    queryFn: () =>
      window.electronAPI.getStudentAnswerScoreSummary(studentAnswerImageId),
  })

// =====================================================================
// 書き込み
// =====================================================================

export const uploadStudentAnswersMutation = (examId: string) =>
  defineMutation({
    mutationFn: (
      filesData: Parameters<typeof window.electronAPI.uploadStudentAnswers>[1]
    ) => window.electronAPI.uploadStudentAnswers(examId, filesData),
    meta: {
      invalidates: [scopeKeys.exam(examId)],
      errorMessage: "答案を取り込めませんでした",
    },
  })

export const deleteStudentAnswerMutation = (examId: string) =>
  defineMutation({
    mutationFn: (studentAnswerImageId: string) =>
      window.electronAPI.deleteStudentAnswer(studentAnswerImageId),
    meta: {
      invalidates: [scopeKeys.exam(examId)],
      errorMessage: "答案を削除できませんでした",
    },
  })

/** 入れ替えた答案の配置をまとめて確定する */
export const applyStudentAnswerPlacementsMutation = (examId: string) =>
  defineMutation({
    mutationFn: (
      moves: Parameters<
        typeof window.electronAPI.applyStudentAnswerPlacements
      >[0]
    ) => window.electronAPI.applyStudentAnswerPlacements(moves),
    meta: {
      invalidates: [scopeKeys.exam(examId)],
      errorMessage: "答案の配置を反映できませんでした",
    },
  })
