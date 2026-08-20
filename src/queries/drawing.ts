import { queryOptions } from "@tanstack/react-query"

import type {
  AnnotationTarget,
  DrawingAnnotation,
  DrawingType,
} from "@/types/drawingAnnotation.types"

import { defineMutation } from "./defineMutation"
import { scopeKeys } from "./keys"

/**
 * 手書き注釈（DrawingAnnotation）の読み書き。
 *
 * 取り出し方が4通りある（行き先別・受験者別・設問別・試験の一覧）。どれも
 * 同じ行を別の切り口で見ているだけなので、書き込みは `scopeKeys.annotation()` を
 * まとめて取り直す。
 *
 * **置き場所（採点行）は運ばない。** 描く側が渡すのは行き先（`AnnotationTarget` ＝
 * 答案＋設問＋採点者）で、採点行が要るかどうかは main が決める。
 *
 * 対応する preload は `electron-src/preload-apis/drawingApi.ts`。
 */

// =====================================================================
// 取得
// =====================================================================

/**
 * 行き先1つ分の注釈（いま開いている答案・設問・採点者）。
 *
 * `QuestionScore` は「受験者×設問×採点者」で1行なので、この行き先に紐づく注釈は
 * 全部同じ採点者のものである（採点者で絞る余地が無い）。**行がまだ無ければ空で返る。
 * 読んだだけで行は増えない。**
 */
export const annotationsByTargetQuery = (
  target: AnnotationTarget,
  type?: DrawingType
) =>
  queryOptions({
    queryKey: [
      ...scopeKeys.annotation(),
      "byTarget",
      target.examStudentId,
      target.cropRegionId,
      target.userId,
      type ?? null,
    ] as const,
    queryFn: () => window.electronAPI.drawing.getByTarget(target, type),
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
 * 採点者は行き先（`target`）が持つ（注釈は自前の採点者を持たない）。
 */
export const createAnnotationMutation = () =>
  defineMutation({
    mutationFn: (write: {
      target: AnnotationTarget
      annotation: DrawingAnnotation
    }) => window.electronAPI.drawing.create(write.target, write.annotation),
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
 * まとめて作る口。
 *
 * 1ストロークが複数の要素になることがあり、注釈ブラウザからの複製では行き先が
 * 生徒ごとに違う。**行き先は1件ずつに持たせる。**
 */
export const batchCreateAnnotationsMutation = () =>
  defineMutation({
    mutationFn: (
      writes: Array<{ target: AnnotationTarget; annotation: DrawingAnnotation }>
    ) => window.electronAPI.drawing.batchCreate(writes),
    scope: { id: "annotation" },
    meta: {
      invalidates: [scopeKeys.annotation()],
      errorMessage: "手書きを保存できませんでした",
    },
  })

/**
 * その行き先の注釈を、渡した内容へ置き換える（消してから作る）。
 *
 * **消すのと作るのを別々の書き込みにしない。** 別々にすると、消す方が失敗しても
 * 作る方は積まれたまま実行され、古い注釈の上に新しい注釈が重なる。かといって
 * 消し終わるのを待ってから作ると、その間に取り直しが走って**注釈が一瞬消えて
 * 戻る**のが見える（間に他の書き込みが挟まらないので `MutationCache` の
 * まとめが効かない）。1つの書き込みにすれば、順序も後始末も1回で済む。
 *
 * 空の並びで呼ぶと消すだけで終わる（作らないので採点行も用意されない）。
 */
export const replaceTargetAnnotationsMutation = () =>
  defineMutation({
    mutationFn: async (input: {
      target: AnnotationTarget
      annotations: DrawingAnnotation[]
    }) => {
      await window.electronAPI.drawing.deleteByTarget(input.target)
      if (input.annotations.length === 0) return []
      return window.electronAPI.drawing.batchCreate(
        input.annotations.map((annotation) => ({
          target: input.target,
          annotation,
        }))
      )
    },
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
