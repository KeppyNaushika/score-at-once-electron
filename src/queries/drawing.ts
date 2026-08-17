import { queryOptions } from "@tanstack/react-query"

import type {
  DrawingAnnotation,
  DrawingType,
} from "@/types/drawingAnnotation.types"

import { defineMutation } from "./defineMutation"
import { scopeKeys } from "./keys"

/**
 * 手書き注釈（DrawingAnnotation）の読み書き。
 *
 * 取り出し方が4通りある（設問スコア別・受験者別・設問別・試験の一覧）。どれも
 * 同じ行を別の切り口で見ているだけなので、書き込みは `scopeKeys.annotation()` を
 * まとめて取り直す。
 *
 * 対応する preload は `electron-src/preload-apis/drawingApi.ts`。
 */

// =====================================================================
// 取得
// =====================================================================

/**
 * 設問スコア1件分の注釈。
 *
 * `QuestionScore` は「受験者×設問×採点者」で1行なので、この行に紐づく注釈は
 * 全部同じ採点者のものである（採点者で絞る余地が無い）。
 */
export const annotationsByQuestionScoreQuery = (
  questionScoreId: string,
  type?: DrawingType
) =>
  queryOptions({
    queryKey: [
      ...scopeKeys.annotation(),
      "byQuestionScore",
      questionScoreId,
      type ?? null,
    ] as const,
    queryFn: () =>
      window.electronAPI.drawing.getByQuestionScore(questionScoreId, type),
  })

/** 受験者1人分の全設問の注釈（個別表示の透明度制御が読む） */
export const annotationsByExamStudentQuery = (
  examStudentId: string,
  userId: string | undefined
) =>
  queryOptions({
    queryKey: [
      ...scopeKeys.annotation(),
      "byExamStudent",
      examStudentId,
      userId ?? null,
    ] as const,
    queryFn: () =>
      window.electronAPI.drawing.getByExamStudent(
        examStudentId,
        undefined,
        userId
      ),
  })

/** 設問1つ分の注釈（グリッド表示が全受験者ぶん一括で取る） */
export const annotationsByCropRegionQuery = (
  cropRegionId: string,
  userId: string | undefined
) =>
  queryOptions({
    queryKey: [
      ...scopeKeys.annotation(),
      "byCropRegion",
      cropRegionId,
      userId ?? null,
    ] as const,
    queryFn: () =>
      window.electronAPI.drawing.getByCropRegion(cropRegionId, userId),
  })

/** その試験の注釈の一覧（側パネルの注釈ブラウザが読む） */
export const annotationsForBrowseQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.annotation(), "forBrowse", examId] as const,
    queryFn: () => window.electronAPI.drawing.getForBrowse(examId),
  })

// =====================================================================
// 書き込み
// =====================================================================

/**
 * 注釈を1件作る。
 *
 * 行をそのまま渡す。列を選んで詰め替えると、列を足したときに永続化から漏れる。
 * 採点者は渡さない（注釈の持ち主は親の `QuestionScore` から決まる）。
 */
export const createAnnotationMutation = () =>
  defineMutation({
    mutationFn: (annotation: DrawingAnnotation) =>
      window.electronAPI.drawing.create(annotation),
    scope: { id: "annotation" },
    meta: {
      invalidates: [scopeKeys.annotation()],
      errorMessage: "手書きを保存できませんでした",
    },
  })

export const updateAnnotationMutation = () =>
  defineMutation({
    mutationFn: (annotation: DrawingAnnotation) =>
      window.electronAPI.drawing.update(annotation),
    scope: { id: "annotation" },
    meta: {
      invalidates: [scopeKeys.annotation()],
      errorMessage: "手書きを保存できませんでした",
    },
  })

export const deleteAnnotationMutation = () =>
  defineMutation({
    mutationFn: (annotationId: string) =>
      window.electronAPI.drawing.delete(annotationId),
    scope: { id: "annotation" },
    meta: {
      invalidates: [scopeKeys.annotation()],
      errorMessage: "手書きを削除できませんでした",
    },
  })

/**
 * その設問スコアに紐づく注釈を全部消す。
 *
 * 「この設問の手書きを消す」は1つの意図で、消える範囲は親の id で言い切れる。
 * 1件ずつ消す形に割ると、途中で失敗したときに半分だけ消えた状態が残る。
 */
export const deleteAnnotationsByQuestionScoreMutation = () =>
  defineMutation({
    mutationFn: (input: { questionScoreId: string; type?: DrawingType }) =>
      window.electronAPI.drawing.deleteByQuestionScore(
        input.questionScoreId,
        input.type
      ),
    scope: { id: "annotation" },
    meta: {
      invalidates: [scopeKeys.annotation()],
      errorMessage: "手書きを削除できませんでした",
    },
  })

/** 1ストロークが複数の要素になることがあるので、まとめて作る口を持つ */
export const batchCreateAnnotationsMutation = () =>
  defineMutation({
    mutationFn: (annotations: DrawingAnnotation[]) =>
      window.electronAPI.drawing.batchCreate(annotations),
    scope: { id: "annotation" },
    meta: {
      invalidates: [scopeKeys.annotation()],
      errorMessage: "手書きを保存できませんでした",
    },
  })

export const toggleAnnotationFavoriteMutation = () =>
  defineMutation({
    mutationFn: (input: { annotationId: string; isFavorite: boolean }) =>
      window.electronAPI.drawing.toggleFavorite(
        input.annotationId,
        input.isFavorite
      ),
    scope: { id: "annotation" },
    meta: {
      invalidates: [scopeKeys.annotation()],
      errorMessage: "お気に入りを切り替えられませんでした",
    },
  })
