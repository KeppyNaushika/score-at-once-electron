/**
 * 点を計算し直す対象の洗い出し（docs/vlm-grading-design.md §4-6）。
 *
 * 計算し直すきっかけは、適用の付け外し・項目の値の変更・配点の変更・採点方式の変更の4つ。
 * どれも「変えたあとの設問と項目」で全行を計算し、保存されている点と食い違う行を返す。
 * 項目は共有なので、他の採点者の行も対象になる（保存の前に件数を示して確認する）。
 *
 * - 項目の値を変える: `withEditedRubricItem` で差し替えた項目の一覧を渡し、
 *   `onlyRubricItemId` でその項目を当てている行に絞る
 * - 項目を消す: `withoutRubricItem` で除いた一覧を渡す（消した項目の適用は数えなくなる）。
 *   適用は main でカスケードで消えるので、消す前の材料で洗い出す
 * - 配点・採点方式を変える: 変えたあとの設問を渡す
 * - 同期の遅れの直し: 自分の行だけ（`scorerUserId`）を、今の設問と項目で洗い出す
 *
 * 手での上書きの行は飛ばす。採点方式が points の設問は計算しないので、対象は無い。
 */

import type {
  RubricScoredRow,
  RubricScoreResult,
  RubricScoringItem,
  RubricScoringRegion,
} from "../types"
import { computeRubricScore, isSameRubricScore } from "./rubricScore"

/** 洗い出しの材料（`getRubricRecalculationSource` の戻りをそのまま渡せる形） */
export interface RubricRecalculationSource extends RubricScoringRegion {
  rubricItems: readonly RubricScoringItem[]
  questionScores: readonly RubricScoredRow[]
}

export interface RubricRecalculationOptions {
  /** この項目を当てている行だけを見る（項目の値を変えた・消したとき） */
  onlyRubricItemId?: string
  /** この採点者の行だけを見る（同期の遅れの直し） */
  scorerUserId?: string
}

/** 点が変わる1行 */
export interface RubricRecalculationChange {
  questionScoreId: string
  userId: string
  before: RubricScoreResult
  after: RubricScoreResult
}

/** 点が変わる行を洗い出す */
export function planRubricRecalculation(
  source: RubricRecalculationSource,
  options: RubricRecalculationOptions = {}
): RubricRecalculationChange[] {
  return source.questionScores
    .filter(
      (questionScore) =>
        options.scorerUserId === undefined ||
        questionScore.userId === options.scorerUserId
    )
    .filter(
      (questionScore) =>
        options.onlyRubricItemId === undefined ||
        questionScore.rubricApplications.some(
          (application) => application.rubricItemId === options.onlyRubricItemId
        )
    )
    .flatMap((questionScore) => {
      const outcome = computeRubricScore(
        source,
        source.rubricItems,
        questionScore
      )
      if (outcome.kind !== "computed") return []
      const before: RubricScoreResult = {
        status: questionScore.status,
        partialScore: questionScore.partialScore,
      }
      if (isSameRubricScore(before, outcome.result)) return []
      return [
        {
          questionScoreId: questionScore.id,
          userId: questionScore.userId,
          before,
          after: outcome.result,
        },
      ]
    })
}

/** 項目の一覧の1つを、直したあとの値に差し替える */
export const withEditedRubricItem = <Item extends RubricScoringItem>(
  rubricItems: readonly Item[],
  editedItem: Item
): Item[] =>
  rubricItems.map((rubricItem) =>
    rubricItem.id === editedItem.id ? editedItem : rubricItem
  )

/** 項目の一覧から1つを除く（消したあとの計算に使う） */
export const withoutRubricItem = <Item extends RubricScoringItem>(
  rubricItems: readonly Item[],
  rubricItemId: string
): Item[] => rubricItems.filter((rubricItem) => rubricItem.id !== rubricItemId)

/** 確認に出す件数。他の採点者は人数と件数、自分は件数 */
export interface RubricRecalculationSummary {
  ownScoreCount: number
  otherScoreCount: number
  otherUserCount: number
}

export function summarizeRubricRecalculation(
  changes: readonly RubricRecalculationChange[],
  actorUserId: string
): RubricRecalculationSummary {
  const otherChanges = changes.filter((change) => change.userId !== actorUserId)
  return {
    ownScoreCount: changes.length - otherChanges.length,
    otherScoreCount: otherChanges.length,
    otherUserCount: new Set(otherChanges.map((change) => change.userId)).size,
  }
}

/** 洗い出した行を、点の書き込み（`writeRubricScoresMutation`）の引数へ */
export const toRubricScoreWrites = (
  changes: readonly RubricRecalculationChange[]
) =>
  changes.map((change) => ({
    questionScoreId: change.questionScoreId,
    status: change.after.status,
    partialScore: change.after.partialScore,
    clearsOverride: false,
  }))
