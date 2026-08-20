import { queryOptions } from "@tanstack/react-query"

import { cropRegionScopes } from "./cropRegion"
import { defineMutation } from "./defineMutation"
import { scopeKeys } from "./keys"

/**
 * 採点（QuestionScore）と、設問ごとの採点担当（CropRegionAssignment）の読み書き。
 *
 * **採点行そのものを取るクエリはここに無い。** 採点行は採点領域（`CropRegion`）の
 * 子として `src/queries/cropRegion.ts` のクエリに載っている。`QuestionScore` を根に
 * 取り直すと、同じ行が別のキーで2度キャッシュされる。
 *
 * 対応する preload は `electron-src/preload-apis/scoringApi.ts`。
 */

// =====================================================================
// 取得
// =====================================================================

/**
 * 裁定サマリ（競合・確定後の新提案）。
 *
 * 試験全体の採点行を走査するので、単独利用（メンバー1人）では呼び出し側が
 * 走らせない。競合はメンバーが1人なら構造的にゼロで、結果は常に空になる。
 */
export const examDecisionSummaryQuery = (examId: string, userId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "decisionSummary", userId] as const,
    queryFn: () => window.electronAPI.getExamDecisionSummary(examId, userId),
  })

/** 設問ごとの採点担当（採点画面の設問絞り込みが読む） */
export const cropRegionAssignmentsQuery = (examId: string, userId: string) =>
  queryOptions({
    queryKey: [
      ...scopeKeys.exam(examId),
      "cropRegionAssignments",
      userId,
    ] as const,
    queryFn: () => window.electronAPI.getCropRegionAssignments(examId, userId),
  })

/**
 * 答案1ページ分の「白さ」（空欄らしさ）。
 *
 * 並び順を白さ順にするために、そのページの全答案 × 全採点領域をまとめて測る。
 * 画像1枚のデコードが支配的なので、領域を増やす費用はほぼ無い。
 *
 * キーの `measurementSignature` は**測るもの全部**（答案の id と画像パス、採点領域の
 * id と矩形）。答案が増減しても、02 で解答欄を動かしても測り直す。設問を切り替えた
 * だけなら測り直さない。
 *
 * **この鍵は `scopeKeys.exam` の外にある。** 白さは画像と矩形だけで決まり採点結果に
 * 依存しないので、試験への書き込みで測り直す必要が無い（画像を読み直すので重い）。
 * そのぶん**入力を鍵で表しきる**責任がこちらにある。
 */
export const answerWhitenessQuery = (
  examPageId: string,
  measurementSignature: string,
  input: Parameters<typeof window.electronAPI.measureAnswerWhiteness>[0]
) =>
  queryOptions({
    queryKey: ["answerWhiteness", examPageId, measurementSignature] as const,
    queryFn: () => window.electronAPI.measureAnswerWhiteness(input),
  })

// =====================================================================
// 書き込み
// =====================================================================

/**
 * 採点する。**行が無ければ作り、有れば上書きする。**
 *
 * `QuestionScore` は「受験者×設問×採点者」で1行。上書きが正しいのは**利用者が
 * 採点したとき**だけなので、renderer から採点行を用意する口は持たない。手書き注釈の
 * 置き場所は、注釈を保存するときに main が用意する（`queries/drawing.ts`）。
 */
export const setQuestionScoreMutation = (examId: string) =>
  defineMutation({
    mutationFn: (
      data: Parameters<typeof window.electronAPI.setQuestionScore>[0]
    ) => window.electronAPI.setQuestionScore(data),
    scope: { id: `exam:${examId}:questionScores` },
    meta: {
      invalidates: cropRegionScopes(examId),
      errorMessage: "採点を保存できませんでした",
    },
  })

/**
 * 採点を1件書き換える。
 *
 * 他の教員が答案ごと消していた場合は `status: "target-deleted"` が返る（例外に
 * しないのは、それが失敗ではなく**結果**だから）。呼び出し側が知らせる。
 */
export const updateQuestionScoreMutation = (examId: string) =>
  defineMutation({
    mutationFn: (input: {
      questionScoreId: string
      data: Parameters<typeof window.electronAPI.updateQuestionScore>[1]
    }) =>
      window.electronAPI.updateQuestionScore(input.questionScoreId, input.data),
    scope: { id: `exam:${examId}:questionScores` },
    meta: {
      invalidates: cropRegionScopes(examId),
      errorMessage: "採点を保存できませんでした",
    },
  })

/**
 * 競合した採点に裁定を下す。
 *
 * 確定は採点行そのものを書き換えるので、裁定サマリも古くなる。
 */
export const finalizeQuestionScoreMutation = (examId: string) =>
  defineMutation({
    mutationFn: (input: {
      examStudentId: string
      cropRegionId: string
      userId: string
      scoreData: Parameters<typeof window.electronAPI.finalizeQuestionScore>[3]
    }) =>
      window.electronAPI.finalizeQuestionScore(
        input.examStudentId,
        input.cropRegionId,
        input.userId,
        input.scoreData
      ),
    scope: { id: `exam:${examId}:questionScores` },
    meta: {
      invalidates: [
        ...cropRegionScopes(examId),
        [...scopeKeys.exam(examId), "decisionSummary"],
      ],
      errorMessage: "採点を確定できませんでした",
    },
  })

/** OMR の自動採点結果をまとめて反映する（1操作＝1回の取り込み） */
export const batchUpdateQuestionScoresMutation = (examId: string) =>
  defineMutation({
    mutationFn: (
      entries: Parameters<
        typeof window.electronAPI.batchUpdateQuestionScores
      >[0]
    ) => window.electronAPI.batchUpdateQuestionScores(entries),
    scope: { id: `exam:${examId}:questionScores` },
    meta: {
      invalidates: cropRegionScopes(examId),
      errorMessage: "自動採点の結果を保存できませんでした",
    },
  })

const assignmentsScope = (examId: string) =>
  [...scopeKeys.exam(examId), "cropRegionAssignments"] as const

export const assignCropRegionMutation = (examId: string) =>
  defineMutation({
    mutationFn: (input: {
      cropRegionId: string
      userId: string
      assignedByUserId: string
    }) =>
      window.electronAPI.assignCropRegion(
        input.cropRegionId,
        input.userId,
        input.assignedByUserId
      ),
    scope: { id: `exam:${examId}:cropRegionAssignments` },
    meta: {
      invalidates: [assignmentsScope(examId)],
      errorMessage: "採点担当を割り当てられませんでした",
    },
  })

export const unassignCropRegionMutation = (examId: string) =>
  defineMutation({
    mutationFn: (input: {
      cropRegionId: string
      userId: string
      requestedByUserId: string
    }) =>
      window.electronAPI.unassignCropRegion(
        input.cropRegionId,
        input.userId,
        input.requestedByUserId
      ),
    scope: { id: `exam:${examId}:cropRegionAssignments` },
    meta: {
      invalidates: [assignmentsScope(examId)],
      errorMessage: "採点担当を外せませんでした",
    },
  })
