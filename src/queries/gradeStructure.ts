import { queryOptions } from "@tanstack/react-query"

import type { GradeDataSourceInput } from "@/types/grade.types"

import { defineMutation } from "./defineMutation"
import { gradeScope } from "./grade"
import { scopeKeys } from "./keys"

/**
 * 成績算出の組み立て（評価項目・データソース・境界・比較と、データソースの候補）の読み書き。
 *
 * 対応する preload は `electron-src/preload-apis/gradeApi.ts`。
 */

/** 比較1件（相手の評価項目・その成績算出・境界を同梱） */
export type GradeComparisonRow = Awaited<
  ReturnType<typeof window.electronAPI.grade.getComparisons>
>[number]

/**
 * この成績算出の評価項目に付いた比較。
 *
 * 相手の値はここには無い。結果画面が相手の成績算出ごとに `gradeResultsQuery` を引く。
 */
export const gradeComparisonsQuery = (gradeId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.grade(gradeId), "comparisons"] as const,
    queryFn: () => window.electronAPI.grade.getComparisons(gradeId),
  })

/**
 * 欠測推定の当てはまり（相関）。
 *
 * **成績のスコープ（`["grade", gradeId]`）の外に置く。** 算出は全試験のスコア取得を
 * 伴って重く、しかも推定の設定を変えたときしか変わらない。スコープ内に置くと、
 * 名前を1文字打つたびの取り直しに巻き込まれる。
 */
export const gradeSourceFitsQuery = (gradeId: string) =>
  queryOptions({
    queryKey: ["gradeSourceFits", gradeId] as const,
    queryFn: () => window.electronAPI.grade.computeSourceFits(gradeId),
  })

/** データソースに指定できる試験1件 */
export type GradeExamCandidateRow = Awaited<
  ReturnType<typeof window.electronAPI.grade.getExamCandidates>
>[number]

/** データソースに指定できる試験の候補 */
export const gradeExamCandidatesQuery = () =>
  queryOptions({
    queryKey: ["grade", "examCandidates"] as const,
    queryFn: () => window.electronAPI.grade.getExamCandidates(),
  })

/** ある試験の中で指定できる小計点グループ1件（小計を同梱） */
export type GradeExamSubtotalGroupRow = Awaited<
  ReturnType<typeof window.electronAPI.grade.getExamSubtotalGroups>
>[number]

/** ある試験の中で指定できる小計点の候補 */
export const gradeExamSubtotalGroupsQuery = (examId: string) =>
  queryOptions({
    queryKey: ["grade", "examSubtotalGroups", examId] as const,
    queryFn: () => window.electronAPI.grade.getExamSubtotalGroups(examId),
  })

/** ある試験の中で指定できる設問領域1件（小計への割り当てを同梱） */
export type GradeExamCropRegionRow = Awaited<
  ReturnType<typeof window.electronAPI.grade.getExamCropRegions>
>[number]

/** ある試験の中で指定できる設問領域の候補 */
export const gradeExamCropRegionsQuery = (examId: string) =>
  queryOptions({
    queryKey: ["grade", "examCropRegions", examId] as const,
    queryFn: () => window.electronAPI.grade.getExamCropRegions(examId),
  })

export const createGradeItemMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (name: string) =>
      window.electronAPI.grade.createGradeItem({ gradeId, name }),
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "評価項目を追加できませんでした",
    },
  })

export const renameGradeItemMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: { id: string; name: string }) =>
      window.electronAPI.grade.updateGradeItem(input.id, { name: input.name }),
    scope: { id: `grade:${gradeId}:items` },
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "評価項目の名前を保存できませんでした",
    },
  })

/** 評価項目を消すと配下のデータソース（＝予測変数の集合）が減るので相関も古くなる */
export const deleteGradeItemMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (gradeItemId: string) =>
      window.electronAPI.grade.deleteGradeItem(gradeItemId),
    meta: {
      invalidates: [
        gradeScope(gradeId),
        gradeSourceFitsQuery(gradeId).queryKey,
      ],
      errorMessage: "評価項目を削除できませんでした",
    },
  })

export const reorderGradeItemsMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (orders: { id: string; order: number }[]) =>
      window.electronAPI.grade.reorderGradeItems(orders),
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "評価項目の並び順を保存できませんでした",
    },
  })

/** ソースを足すと予測変数・対象が増えるので相関も古くなる */
export const createDataSourceMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: GradeDataSourceInput) =>
      window.electronAPI.grade.createDataSource(input),
    meta: {
      invalidates: [
        gradeScope(gradeId),
        gradeSourceFitsQuery(gradeId).queryKey,
      ],
      errorMessage: "データソースを追加できませんでした",
    },
  })

/**
 * 名前と換算満点を変える。**相関は変わらないので取り直さない**
 * （重い再算出を打鍵のたびに走らせない）。
 */
export const renameDataSourceMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: { id: string; name: string; weight: number }) =>
      window.electronAPI.grade.updateDataSource(input.id, {
        name: input.name,
        weight: input.weight,
      }),
    scope: { id: `grade:${gradeId}:dataSources` },
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "データソースを保存できませんでした",
    },
  })

/**
 * 欠測推定の設定を変える。予測の前提が変わるので相関も取り直す。
 *
 * **列の顔ぶれは IPC の引数から導く。** ここで手書きすると、書き写しが1つずれても
 * 型検査に掛からない（対象が全て optional なので「必須の欠落」にならず、変数で渡す
 * 限り余剰プロパティ検査も働かない）。実際それで、一括設定が常に失敗していたのに
 * `tsc` が黙っていた。
 */
export const updateDataSourceEstimationMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string
    } & Parameters<typeof window.electronAPI.grade.updateDataSource>[1]) =>
      window.electronAPI.grade.updateDataSource(id, data),
    scope: { id: `grade:${gradeId}:dataSources` },
    meta: {
      invalidates: [
        gradeScope(gradeId),
        gradeSourceFitsQuery(gradeId).queryKey,
      ],
      errorMessage: "欠測時の設定を保存できませんでした",
    },
  })

export const deleteDataSourceMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (dataSourceId: string) =>
      window.electronAPI.grade.deleteDataSource(dataSourceId),
    meta: {
      invalidates: [
        gradeScope(gradeId),
        gradeSourceFitsQuery(gradeId).queryKey,
      ],
      errorMessage: "データソースを削除できませんでした",
    },
  })

export const reorderDataSourcesMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (orders: { id: string; order: number }[]) =>
      window.electronAPI.grade.reorderDataSources(orders),
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "データソースの並び順を保存できませんでした",
    },
  })

/**
 * プリセットを当てる。**一括経路**（`docs/coding-style.md` の「状態を運んでよい経路」）。
 * 「この刻みにしろ」という指示そのものなので、触っていない行という概念が無い。
 */
export const applyGradeBoundaryPresetMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: {
      gradeItemId: string
      boundaries: { label: string; minPercentage: number; order: number }[]
    }) => window.electronAPI.grade.replaceGradeItemBoundaries(input),
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "評定の刻みを設定できませんでした",
    },
  })

export const createGradeItemBoundaryMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: {
      gradeItemId: string
      label: string
      minPercentage: number
      order: number
    }) => window.electronAPI.grade.createGradeItemBoundary(input),
    scope: { id: `grade:${gradeId}:boundaries` },
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "評定の境界を追加できませんでした",
    },
  })

export const updateGradeItemBoundaryMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: {
      id: string
      label?: string
      minPercentage?: number
    }) => window.electronAPI.grade.updateGradeItemBoundary(input),
    scope: { id: `grade:${gradeId}:boundaries` },
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "評定の境界を保存できませんでした",
    },
  })

export const deleteGradeItemBoundaryMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (boundaryId: string) =>
      window.electronAPI.grade.deleteGradeItemBoundary(boundaryId),
    scope: { id: `grade:${gradeId}:boundaries` },
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "評定の境界を削除できませんでした",
    },
  })

export const reorderGradeItemBoundariesMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (orders: { id: string; order: number }[]) =>
      window.electronAPI.grade.reorderGradeItemBoundaries(orders),
    scope: { id: `grade:${gradeId}:boundaries` },
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "評定の境界の並び順を保存できませんでした",
    },
  })

/** 確認ダイアログを経た「全部消す」。1本ずつの削除とは別の意図として扱う */
export const deleteAllGradeItemBoundariesMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (gradeItemId: string) =>
      window.electronAPI.grade.deleteGradeItemBoundaries(gradeItemId),
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "評定の境界を削除できませんでした",
    },
  })

export const createGradeComparisonMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: { gradeItemId: string; comparedGradeItemId: string }) =>
      window.electronAPI.grade.createComparison(input),
    scope: { id: `grade:${gradeId}:comparisons` },
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "比較を追加できませんでした",
    },
  })

export const deleteGradeComparisonMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (comparisonId: string) =>
      window.electronAPI.grade.deleteComparison(comparisonId),
    scope: { id: `grade:${gradeId}:comparisons` },
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "比較を削除できませんでした",
    },
  })

export const reorderGradeComparisonsMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (orders: { id: string; order: number }[]) =>
      window.electronAPI.grade.reorderComparisons(orders),
    scope: { id: `grade:${gradeId}:comparisons` },
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "比較の並び順を保存できませんでした",
    },
  })
