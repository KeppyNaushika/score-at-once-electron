import { queryOptions } from "@tanstack/react-query"

import type {
  GradeCellTarget,
  GradeConstraintInput,
  GradeOverrideInput,
} from "@/types/grade.types"

import { defineMutation } from "./defineMutation"
import { gradeScope } from "./grade"
import { scopeKeys } from "./keys"

/**
 * 成績算出の調整（評定の上書き・確定・観点間の制約・評価項目の除外）の読み書き。
 *
 * 対応する preload は `electron-src/preload-apis/gradeApi.ts`。
 */

/** 観点間の制約ルール */
export const gradeConstraintsQuery = (gradeId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.grade(gradeId), "constraints"] as const,
    queryFn: () => window.electronAPI.grade.getGradeConstraints(gradeId),
  })

/**
 * 除外セルの同定キー。除外の主語は「その成績の対象者」（GradeStudent）であり、
 * 人（Student）ではない。どちらも string なので、実体ではなくキーを組み立てる
 * この一箇所に集約して取り違えを防ぐ。
 */
export const buildGradeExclusionKey = (target: GradeCellTarget) =>
  `${target.gradeStudentId}:${target.gradeItemId}`

/** 除外設定1行 */
export type GradeItemExclusionRow = Awaited<
  ReturnType<typeof window.electronAPI.grade.getGradeItemExclusions>
>[number]

/** 対象者ごとの評価項目の除外設定（行のまま） */
export const gradeItemExclusionsQuery = (gradeId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.grade(gradeId), "exclusions"] as const,
    queryFn: () => window.electronAPI.grade.getGradeItemExclusions(gradeId),
  })

export const upsertGradeOverrideMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: GradeOverrideInput & { overrideLabel: string }) =>
      window.electronAPI.grade.upsertGradeOverride({
        gradeStudentId: input.gradeStudentId,
        gradeItemId: input.gradeItemId,
        overrideLabel: input.overrideLabel,
      }),
    scope: { id: `grade:${gradeId}:overrides` },
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "評定の上書きを保存できませんでした",
    },
  })

export const deleteGradeOverrideMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (target: GradeCellTarget) =>
      window.electronAPI.grade.deleteGradeOverride(target),
    scope: { id: `grade:${gradeId}:overrides` },
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "評定の上書きを解除できませんでした",
    },
  })

export const freezeGradeScoresMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: {
      targets?: GradeCellTarget[]
      frozenByUserId: string | null
    }) =>
      window.electronAPI.grade.freezeGradeScores({
        gradeId,
        targets: input.targets,
        frozenByUserId: input.frozenByUserId,
      }),
    scope: { id: `grade:${gradeId}:frozen` },
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "成績値を確定できませんでした",
    },
  })

export const unfreezeGradeScoresMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: {
      targets?: GradeCellTarget[]
      userId: string | null
    }) =>
      window.electronAPI.grade.unfreezeGradeScores({
        gradeId,
        targets: input.targets,
        userId: input.userId,
      }),
    scope: { id: `grade:${gradeId}:frozen` },
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "確定を解除できませんでした",
    },
  })

export const createGradeConstraintMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (constraint: GradeConstraintInput) =>
      window.electronAPI.grade.createGradeConstraint({ gradeId, constraint }),
    meta: {
      invalidates: [gradeConstraintsQuery(gradeId).queryKey],
      errorMessage: "制約ルールを追加できませんでした",
    },
  })

export const updateGradeConstraintMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: {
      id: string
      constraint: Partial<GradeConstraintInput>
    }) => window.electronAPI.grade.updateGradeConstraint(input),
    scope: { id: `grade:${gradeId}:constraints` },
    meta: {
      invalidates: [gradeConstraintsQuery(gradeId).queryKey],
      errorMessage: "制約ルールを保存できませんでした",
    },
  })

export const deleteGradeConstraintMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (constraintId: string) =>
      window.electronAPI.grade.deleteGradeConstraint(constraintId),
    meta: {
      invalidates: [gradeConstraintsQuery(gradeId).queryKey],
      errorMessage: "制約ルールを削除できませんでした",
    },
  })

/**
 * 1マスの除外を切り替える。
 *
 * **`scope` は `invalidates` と同じ単位で取る。** レコード単位にすると、格子の
 * マスごとに `useMutation` を呼ぶ必要が出る（フックはループの中で呼べないので、
 * マスごとのコンポーネントが要る）。書き込みは1ミリ秒台で端末間の競合も起きない
 * ため、まとめて直列にしても待ち時間は測れない。順序はむしろ全体で保証される。
 */
export const setGradeItemExclusionMutation = (gradeId: string) =>
  defineMutation({
    mutationFn: (input: { target: GradeCellTarget; excluded: boolean }) =>
      window.electronAPI.grade.setGradeItemExclusion({
        ...input.target,
        excluded: input.excluded,
      }),
    scope: { id: `grade:${gradeId}:exclusions` },
    meta: {
      invalidates: [gradeScope(gradeId)],
      errorMessage: "対象生徒の設定を保存できませんでした",
    },
  })
