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
    // **開くたびに必ず数え直す。** これは「消す前に何を消すのか数える」ための取得で、
    // 古い答えを見せると採点済みの答案を「採点データなし」と告げて消せてしまう。
    // 鍵は試験のまとまりの外にあるので採点の書き込みで古くならず、本体は開いている
    // 間しか mount されないので gcTime 内に開き直すとキャッシュがそのまま出る。
    // 無効化に頼っても他の教員が採点した分は届かない（同期はキャッシュを触らない）
    // ので、開いたら必ず取り直す（docs/branch-review-findings.md #13）。
    staleTime: 0,
    refetchOnMount: "always",
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
