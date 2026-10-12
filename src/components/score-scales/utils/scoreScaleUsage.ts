/**
 * 類型評価（類型の組）の使われ方と、編集の欄の読み取り（docs/vlm-grading-design.md §4-8-3・§4-8-3a）。
 *
 * 使われている件数は main が返した include の行を数える（main では数えない）。
 * 03 の領域情報と類型評価管理の画面が、同じ数え方・同じ言い方を使う。
 */

import type { ScoreScaleLevelRow, ScoreScaleRow } from "@/queries/scoreScale"

/** 使っている設問の行のうち、ここで読むところ（どの試験の設問か） */
type UsingCropRegions = {
  cropRegions: readonly { examPage: { examId: string } }[]
}

/** 類型を使っている行の数（付けた採点・確定・類型を決める項目）。1件でもあれば消せない */
export const scaleLevelUsageCount = (
  scaleLevel: Record<
    "questionScores" | "scoreDecisions" | "settingRubricItems",
    readonly unknown[]
  >
): number =>
  scaleLevel.questionScores.length +
  scaleLevel.scoreDecisions.length +
  scaleLevel.settingRubricItems.length

/** 組を使っている設問の、試験の数と設問の数 */
export const scoreScaleUsageSummary = (
  scoreScale: UsingCropRegions
): { examCount: number; cropRegionCount: number } => ({
  examCount: new Set(
    scoreScale.cropRegions.map((cropRegion) => cropRegion.examPage.examId)
  ).size,
  cropRegionCount: scoreScale.cropRegions.length,
})

/**
 * 共通の組を直すとき確かめるか。共通の組の点数・類型を直すと、使っているすべての試験の点が変わる
 * （点は保存せず、読むときに類型の点数を引くため）。使っている設問が無ければ点は変わらない
 */
export const needsGlobalEditConfirmation = (
  scoreScale: Pick<ScoreScaleRow, "examId"> & UsingCropRegions
): boolean => scoreScale.examId === null && scoreScale.cropRegions.length > 0

/** 共通の組を試験のものに戻せるか。戻せるなら戻す試験、戻せないなら理由 */
export type ExamReturnTarget =
  { kind: "available"; examId: string } | { kind: "blocked"; reason: string }

/**
 * 共通の組を戻す試験を決める。
 *
 * - 03 から（`contextExamId` がある）: その試験へ。ほかの試験の設問が使っていれば戻せない
 * - 管理の画面から: 使っている設問がちょうど1つの試験のものなら、その試験へ。
 *   いくつもの試験が使っていれば戻せない。どこも使っていなければ戻す試験が無い
 */
export function examReturnTargetOf(
  scoreScale: UsingCropRegions,
  contextExamId: string | null
): ExamReturnTarget {
  const usingExamIds = new Set(
    scoreScale.cropRegions.map((cropRegion) => cropRegion.examPage.examId)
  )
  if (contextExamId !== null) {
    const usedElsewhere = [...usingExamIds].some(
      (usingExamId) => usingExamId !== contextExamId
    )
    return usedElsewhere
      ? { kind: "blocked", reason: "ほかの試験の設問も使っています" }
      : { kind: "available", examId: contextExamId }
  }
  if (usingExamIds.size > 1) {
    return { kind: "blocked", reason: "ほかの試験の設問も使っています" }
  }
  const [onlyExamId] = usingExamIds
  return onlyExamId === undefined
    ? {
        kind: "blocked",
        reason: "使っている設問が無いので、戻す試験がありません",
      }
    : { kind: "available", examId: onlyExamId }
}

/** 点数の欄に打った文字の読み */
type ScoreInput =
  /** 書ける点数（0 以上の有限の数。配点を超えてよい） */
  | { kind: "score"; score: number }
  /** 数にできない途中（空欄・`-`・`.` など）や負の数。書かない */
  | { kind: "incomplete" }

/**
 * 点数の欄の文字を読む。配点の欄（`readPointsInput`）と同じく、数にできない途中は書かず、
 * 次の打鍵で確定する。点数は空欄を許さない（類型には必ず点数がある）
 */
export function readScoreInput(text: string): ScoreInput {
  if (text.trim() === "") return { kind: "incomplete" }
  const score = Number(text)
  return Number.isFinite(score) && score >= 0
    ? { kind: "score", score }
    : { kind: "incomplete" }
}

/** 類型を1つ動かしたあとの並び順（全類型を 0 から振り直す） */
export function moveScaleLevel(
  scaleLevelIds: readonly string[],
  fromIndex: number,
  toIndex: number
): { id: string; sortOrder: number }[] {
  const movedIds = [...scaleLevelIds]
  const [movingId] = movedIds.splice(fromIndex, 1)
  if (movingId === undefined) {
    return scaleLevelIds.map((id, index) => ({ id, sortOrder: index }))
  }
  movedIds.splice(toIndex, 0, movingId)
  return movedIds.map((id, index) => ({ id, sortOrder: index }))
}

/** 0.5 刻みに丸める（既定の点数を配点から決めるとき） */
const roundToHalf = (score: number): number => Math.round(score * 2) / 2

/** 配点が分からないときの、新しい組の類型の点数 */
const DEFAULT_LEVEL_POINTS = 10

/**
 * 新しく作る組の類型（あとから直せる）。配点 P が分かれば A=P・B=P×0.6・C=P×0.3（0.5 刻み）、
 * 分からなければ（管理の画面から作る・配点が未設定）10点を満点として同じ比で決める
 */
export function defaultScaleLevels(
  points: number | null
): { label: string; score: number }[] {
  const fullScore =
    points !== null && points > 0 ? points : DEFAULT_LEVEL_POINTS
  return [
    { label: "A", score: fullScore },
    { label: "B", score: roundToHalf(fullScore * 0.6) },
    { label: "C", score: roundToHalf(fullScore * 0.3) },
  ]
}

/** 類型の並びの短い言い方（例「A 10 / B 6 / C 3」） */
export const scaleLevelsSummary = (
  levels: readonly Pick<ScoreScaleLevelRow, "label" | "score">[]
): string =>
  levels.length === 0
    ? "類型なし"
    : levels
        .map((level) => `${level.label || "（記号なし）"} ${level.score}`)
        .join(" / ")
