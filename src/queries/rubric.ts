import { queryOptions } from "@tanstack/react-query"

import { defineMutation } from "./defineMutation"
import { scopeKeys } from "./keys"
import { questionScoresQuery, questionScoresScope } from "./scoring"

/**
 * ルーブリック採点（教員の層）の項目・採点方式・適用・項目から計算した点
 * （docs/vlm-grading-design.md §4・§11）。
 *
 * **項目と適用は設問ごとに1本のキーへ載せる。** 採点行（`scoring.ts`）と同じ粒度で、
 * 当てる・外すで古くなるのもその設問だけである。
 *
 * 点の計算は画面の純粋関数（`07-score-at-once/Rubric/utils/`）で行い、結果を
 * `writeRubricScoresMutation` で書く。
 *
 * 対応する preload は `electron-src/preload-apis/rubricApi.ts`。
 */

// =====================================================================
// 取得
// =====================================================================

/** 設問の項目のまとまり（項目・適用・計算し直しの材料） */
const rubricScope = (examId: string, cropRegionId: string) =>
  [...scopeKeys.exam(examId), "rubric", cropRegionId] as const

/** 試験の全設問の項目を指すキー */
const rubricItemsOfExamScope = (examId: string) =>
  [...scopeKeys.exam(examId), "rubricItemsOfExam"] as const

/** 設問の項目1件（作成者付き） */
export type RubricItemRow = Awaited<
  ReturnType<typeof window.electronAPI.rubric.listItems>
>[number]

/** 設問の項目（どの教員が作ったものも。作成者付き。並び順） */
export const rubricItemsQuery = (examId: string, cropRegionId: string) =>
  queryOptions({
    queryKey: [...rubricScope(examId, cropRegionId), "items"] as const,
    queryFn: () => window.electronAPI.rubric.listItems(cropRegionId),
  })

/** 試験の全設問の項目（設問一覧の印など、設問をまたぐ表示に使う） */
export const rubricItemsOfExamQuery = (examId: string) =>
  queryOptions({
    queryKey: rubricItemsOfExamScope(examId),
    queryFn: () => window.electronAPI.rubric.listItemsByExam(examId),
  })

/** 設問の適用1件 */
export type RubricApplicationRow = Awaited<
  ReturnType<typeof window.electronAPI.rubric.listApplications>
>[number]

/**
 * 設問の適用（採点者を問わない）。07 は自分の採点だけを見せるので、採点行
 * （`questionScoresQuery`）と突き合わせて自分の行の適用だけを使う
 */
export const rubricApplicationsQuery = (examId: string, cropRegionId: string) =>
  queryOptions({
    queryKey: [...rubricScope(examId, cropRegionId), "applications"] as const,
    queryFn: () => window.electronAPI.rubric.listApplications(cropRegionId),
  })

/**
 * 点を計算し直す材料（設問・項目・適用のある全採点者の採点行と適用）。
 *
 * 項目の値・採点方式・配点を変える前に読み、どの行の点が変わるかを洗い出して確認に出す
 * （`planRubricRecalculation`）。同期の遅れを拾うため、確認を出すたびに読み直す
 * （`staleTime: 0`）
 */
export const rubricRecalculationSourceQuery = (
  examId: string,
  cropRegionId: string
) =>
  queryOptions({
    queryKey: [
      ...rubricScope(examId, cropRegionId),
      "recalculationSource",
    ] as const,
    queryFn: () =>
      window.electronAPI.rubric.getRecalculationSource(cropRegionId),
    staleTime: 0,
  })

// =====================================================================
// 書き込み
// =====================================================================

/** 項目の作り・直し・消しが古くする先（その設問の項目と適用、試験の全設問の項目） */
const rubricItemInvalidations = (examId: string, cropRegionId: string) =>
  [rubricScope(examId, cropRegionId), rubricItemsOfExamScope(examId)] as const

/** 項目を1つ作る（作成者は main が操作者から決める） */
export const createRubricItemMutation = (
  examId: string,
  cropRegionId: string
) =>
  defineMutation({
    mutationFn: (
      data: Parameters<typeof window.electronAPI.rubric.createItem>[0]
    ) => window.electronAPI.rubric.createItem(data),
    scope: { id: `exam:${examId}:rubric:${cropRegionId}` },
    meta: {
      invalidates: rubricItemInvalidations(examId, cropRegionId),
      errorMessage: "ルーブリック項目を作成できませんでした",
    },
  })

/**
 * 項目を直す。他の採点者の点の計算し直しは、続けて `writeRubricScoresMutation` で書く
 * （直す前に `rubricRecalculationSourceQuery` で件数を示して確認する。§4-6）
 */
export const updateRubricItemMutation = (
  examId: string,
  cropRegionId: string
) =>
  defineMutation({
    mutationFn: (input: {
      rubricItemId: string
      data: Parameters<typeof window.electronAPI.rubric.updateItem>[1]
    }) => window.electronAPI.rubric.updateItem(input.rubricItemId, input.data),
    scope: { id: `exam:${examId}:rubric:${cropRegionId}` },
    meta: {
      invalidates: rubricItemInvalidations(examId, cropRegionId),
      errorMessage: "ルーブリック項目を変更できませんでした",
    },
  })

/**
 * 項目を消す。適用はカスケードで消えるので、点の計算し直しは消す前に読んだ材料で行う。
 * 採点行の印（適用の有無）も変わるので、その設問の採点行も取り直す
 */
export const deleteRubricItemMutation = (
  examId: string,
  cropRegionId: string
) =>
  defineMutation({
    mutationFn: (rubricItemId: string) =>
      window.electronAPI.rubric.deleteItem(rubricItemId),
    scope: { id: `exam:${examId}:rubric:${cropRegionId}` },
    meta: {
      invalidates: [
        ...rubricItemInvalidations(examId, cropRegionId),
        questionScoresQuery(examId, cropRegionId).queryKey,
      ],
      errorMessage: "ルーブリック項目を削除できませんでした",
    },
  })

/**
 * 設問の採点方式を変える。設問の行は試験のまとまりで読まれているので、採点領域の
 * 他の書き込み（`cropRegion.ts`）と同じく試験ぶんを取り直す
 */
export const setScoringMethodMutation = (examId: string) =>
  defineMutation({
    mutationFn: (input: {
      cropRegionId: string
      scoringMethod: Parameters<
        typeof window.electronAPI.rubric.setScoringMethod
      >[1]
    }) =>
      window.electronAPI.rubric.setScoringMethod(
        input.cropRegionId,
        input.scoringMethod
      ),
    scope: { id: `exam:${examId}:cropRegions` },
    meta: {
      invalidates: [scopeKeys.exam(examId)],
      errorMessage: "採点方式を変更できませんでした",
    },
  })

/**
 * 自分の採点行に項目をまとめて当てる・外す。付け外ししたマスの採点行（適用付き）が返るので、
 * 続けて点を計算して `writeRubricScoresMutation` で書く。行を用意することがあるので採点行も取り直す
 */
export const setRubricApplicationsMutation = (
  examId: string,
  cropRegionId: string
) =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.rubric.setApplications>[0]
    ) => window.electronAPI.rubric.setApplications(input),
    scope: { id: `exam:${examId}:questionScores` },
    meta: {
      invalidates: [
        rubricScope(examId, cropRegionId),
        questionScoresQuery(examId, cropRegionId).queryKey,
      ],
      errorMessage: "ルーブリック項目を当てられませんでした",
    },
  })

/**
 * 項目から計算した点をまとめて書く（status / partialScore。上書きの印は外す）。
 *
 * 他の採点者の行も書く（§4-6）。もう無い行・読んだあとに採点キーで上書きされた行は main が
 * 飛ばして返す。書いた先の設問を絞れない（項目は設問ごとだが、呼び出し側が混ぜうる）ので
 * 採点行は試験ぶんを取り直す
 */
export const writeRubricScoresMutation = (examId: string) =>
  defineMutation({
    mutationFn: (
      writes: Parameters<typeof window.electronAPI.rubric.writeScores>[0]
    ) => window.electronAPI.rubric.writeScores(writes),
    scope: { id: `exam:${examId}:questionScores` },
    meta: {
      invalidates: [
        questionScoresScope(examId),
        [...scopeKeys.exam(examId), "rubric"],
      ],
      errorMessage: "ルーブリック項目からの採点を保存できませんでした",
    },
  })
