import { queryOptions } from "@tanstack/react-query"

import { defineMutation } from "./defineMutation"
import { scopeKeys } from "./keys"

/**
 * 類型評価（類型の組）と類型（docs/vlm-grading-design.md §4-8-3・§4-8-3a）。
 *
 * 組は共通（どの試験でも選べる）のものと試験のものがあり、03 の領域情報と類型評価管理の
 * 画面のどちらからでも直せる。共通の組を直すと、使っているどの試験の画面も古くなるので、
 * 組の読み取りは試験のまとまりの外（`scoreScales`）に置き、書き込みはそのまとまりごと取り直す。
 *
 * 対応する preload は `electron-src/preload-apis/rubricApi.ts`（`rubric:*ScoreScale*`）。
 */

/** 組の読み取り全部（試験ごとの一覧も管理の画面の一覧も） */
const scoreScalesScope = ["scoreScales"] as const

/** 組1件（類型・使っている設問・類型を使っている行付き） */
export type ScoreScaleRow = Awaited<
  ReturnType<typeof window.electronAPI.rubric.listScoreScales>
>[number]

/** 類型1件（類型を使っている採点・確定・項目付き） */
export type ScoreScaleLevelRow = ScoreScaleRow["levels"][number]

/** その試験で選べる組（その試験のものと共通のもの） */
export const examScoreScalesQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scoreScalesScope, "exam", examId] as const,
    queryFn: () => window.electronAPI.rubric.listScoreScales({ examId }),
  })

/** すべての組（類型評価管理の画面） */
export const allScoreScalesQuery = () =>
  queryOptions({
    queryKey: [...scoreScalesScope, "all"] as const,
    queryFn: () => window.electronAPI.rubric.listScoreScales({ examId: null }),
  })

const SCORE_SCALE_MUTATION_SCOPE = { id: "scoreScales" }

/** 組を作る（最初の類型は画面が渡す）。examId が null なら共通 */
export const createScoreScaleMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.rubric.createScoreScale>[0]
    ) => window.electronAPI.rubric.createScoreScale(input),
    scope: SCORE_SCALE_MUTATION_SCOPE,
    meta: {
      invalidates: [scoreScalesScope],
      errorMessage: "類型評価を作成できませんでした",
    },
  })

/** 組の名前を変える（1打鍵ごと） */
export const updateScoreScaleMutation = () =>
  defineMutation({
    mutationFn: (input: { scoreScaleId: string; name: string }) =>
      window.electronAPI.rubric.updateScoreScale(input.scoreScaleId, {
        name: input.name,
      }),
    scope: SCORE_SCALE_MUTATION_SCOPE,
    meta: {
      invalidates: [scoreScalesScope],
      errorMessage: "類型評価の名前を変更できませんでした",
    },
  })

/** 共通にする（examId を null に）・試験に戻す */
export const setScoreScaleExamMutation = () =>
  defineMutation({
    mutationFn: (input: { scoreScaleId: string; examId: string | null }) =>
      window.electronAPI.rubric.setScoreScaleExam(
        input.scoreScaleId,
        input.examId
      ),
    scope: SCORE_SCALE_MUTATION_SCOPE,
    meta: {
      invalidates: [scoreScalesScope],
      errorMessage: "類型評価の使える範囲を変更できませんでした",
    },
  })

/**
 * 組を類型ごと複製し、渡した設問を複製へ付け替える（「この試験用に複製して直す」）。
 * 設問の行も変わるので、付け替えた試験のまとまりも取り直す
 */
export const duplicateScoreScaleMutation = (examId: string | null) =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.rubric.duplicateScoreScale>[0]
    ) => window.electronAPI.rubric.duplicateScoreScale(input),
    scope: SCORE_SCALE_MUTATION_SCOPE,
    meta: {
      invalidates:
        examId === null
          ? [scoreScalesScope]
          : [scoreScalesScope, scopeKeys.exam(examId)],
      errorMessage: "類型評価を複製できませんでした",
    },
  })

/** 組を消す（使っている設問があれば main が拒む） */
export const deleteScoreScaleMutation = () =>
  defineMutation({
    mutationFn: (scoreScaleId: string) =>
      window.electronAPI.rubric.deleteScoreScale(scoreScaleId),
    scope: SCORE_SCALE_MUTATION_SCOPE,
    meta: {
      invalidates: [scoreScalesScope],
      errorMessage: "類型評価を削除できませんでした",
    },
  })

/** 類型を組の最後に足す */
export const createScoreScaleLevelMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<
        typeof window.electronAPI.rubric.createScoreScaleLevel
      >[0]
    ) => window.electronAPI.rubric.createScoreScaleLevel(input),
    scope: SCORE_SCALE_MUTATION_SCOPE,
    meta: {
      invalidates: [scoreScalesScope],
      errorMessage: "類型を追加できませんでした",
    },
  })

/** 類型の記号・説明・点数を変える（1打鍵ごと） */
export const updateScoreScaleLevelMutation = () =>
  defineMutation({
    mutationFn: (input: {
      scaleLevelId: string
      data: Parameters<
        typeof window.electronAPI.rubric.updateScoreScaleLevel
      >[1]
    }) =>
      window.electronAPI.rubric.updateScoreScaleLevel(
        input.scaleLevelId,
        input.data
      ),
    scope: SCORE_SCALE_MUTATION_SCOPE,
    meta: {
      invalidates: [scoreScalesScope],
      errorMessage: "類型を変更できませんでした",
    },
  })

/** 類型の並び順を入れ替える */
export const reorderScoreScaleLevelsMutation = () =>
  defineMutation({
    mutationFn: (input: {
      scaleId: string
      orders: { id: string; sortOrder: number }[]
    }) =>
      window.electronAPI.rubric.reorderScoreScaleLevels(
        input.scaleId,
        input.orders
      ),
    scope: SCORE_SCALE_MUTATION_SCOPE,
    meta: {
      invalidates: [scoreScalesScope],
      errorMessage: "類型を並び替えられませんでした",
    },
  })

/** 類型を消す（付けた採点・確定・項目が使っていれば main が拒む） */
export const deleteScoreScaleLevelMutation = () =>
  defineMutation({
    mutationFn: (scaleLevelId: string) =>
      window.electronAPI.rubric.deleteScoreScaleLevel(scaleLevelId),
    scope: SCORE_SCALE_MUTATION_SCOPE,
    meta: {
      invalidates: [scoreScalesScope],
      errorMessage: "類型を削除できませんでした",
    },
  })

/**
 * 設問の類型評価で使う組を選ぶ（null で外す）。設問の行は試験のまとまりで読まれ、
 * 組の「使っている設問」も変わるので両方を取り直す
 */
export const setCropRegionScoreScaleMutation = (examId: string) =>
  defineMutation({
    mutationFn: (input: {
      cropRegionId: string
      scoreScaleId: string | null
    }) =>
      window.electronAPI.rubric.setCropRegionScoreScale(
        input.cropRegionId,
        input.scoreScaleId
      ),
    scope: { id: `exam:${examId}:cropRegions` },
    meta: {
      invalidates: [scopeKeys.exam(examId), scoreScalesScope],
      errorMessage: "類型評価を選べませんでした",
    },
  })
