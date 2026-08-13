import { queryOptions } from "@tanstack/react-query"

import type { GradeCellTarget } from "@/types/grade.types"

import { defineMutation } from "./defineMutation"
import { scopeKeys } from "./keys"

/**
 * 成績算出（Grade）の読み書き。
 *
 * `window.electronAPI` を書いてよいのは `src/queries/**` だけ。キーと呼び出しが
 * ここで1つに結びつくので、同じデータが別のキーで2度キャッシュされることが起きない。
 *
 * 対応する preload は `electron-src/preload-apis/gradeApi.ts`。
 */

/**
 * 除外セルの同定キー。除外の主語は「その成績の対象者」（GradeStudent）であり、
 * 人（Student）ではない。どちらも string なので、実体ではなくキーを組み立てる
 * この一箇所に集約して取り違えを防ぐ。
 */
export const buildGradeExclusionKey = (target: GradeCellTarget) =>
  `${target.gradeStudentId}:${target.gradeItemId}`

/** 対象者ごとの評価項目の除外設定 */
export const gradeItemExclusionsQuery = (gradeId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.grade(gradeId), "exclusions"] as const,
    queryFn: async (): Promise<ReadonlySet<string>> =>
      new Set(
        (await window.electronAPI.grade.getGradeItemExclusions(gradeId)).map(
          buildGradeExclusionKey
        )
      ),
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
      invalidates: gradeItemExclusionsQuery(gradeId).queryKey,
      errorMessage: "対象生徒の設定を保存できませんでした",
    },
  })
