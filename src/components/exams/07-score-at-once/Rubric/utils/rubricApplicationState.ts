/**
 * 07 の画面が読む、自分の採点行と適用の突き合わせ（docs/vlm-grading-design.md §4-3・§4-5）。
 *
 * 適用は採点者を問わず設問ぶんが届く（`rubricApplicationsQuery`）。07 は自分の採点だけを
 * 見せるので、自分の採点行（`findQuestionScore`）の id で絞って読む。
 */

import { findQuestionScore } from "@/components/exams/07-score-at-once/types"
import type { RubricApplicationRow } from "@/queries/rubric"
import type { QuestionScoreRow } from "@/queries/scoring"
import { toScoringStatus } from "@/types/scoringStatus.types"

import type { RubricScoredRow } from "../types"

/** 適用の無い採点行の集合（毎回作り直さない） */
const NO_APPLIED_ITEM_IDS: ReadonlySet<string> = new Set()

/** 採点行ごとに、当たっている項目の集合（同期で重なった適用は1つにまとまる） */
export function groupAppliedItemIds(
  rubricApplications: readonly RubricApplicationRow[]
): ReadonlyMap<string, ReadonlySet<string>> {
  return rubricApplications.reduce((acc, application) => {
    const appliedItemIds = acc.get(application.questionScoreId) ?? new Set()
    appliedItemIds.add(application.rubricItemId)
    acc.set(application.questionScoreId, appliedItemIds)
    return acc
  }, new Map<string, Set<string>>())
}

/** 1マスの、自分の採点行と当たっている項目 */
export interface OwnRubricCell {
  /** 自分の採点行（まだ無ければ undefined） */
  questionScore: QuestionScoreRow | undefined
  appliedItemIds: ReadonlySet<string>
  /** 採点キーで付けた点が項目より優先している（手での上書き） */
  overridesRubric: boolean
}

/** 受験者1人の、自分の採点行と当たっている項目 */
export function ownRubricCellOf(
  questionScores: readonly QuestionScoreRow[],
  appliedItemIdsByQuestionScoreId: ReadonlyMap<string, ReadonlySet<string>>,
  examStudentId: string,
  currentUserId: string
): OwnRubricCell {
  const questionScore = findQuestionScore(
    questionScores,
    examStudentId,
    currentUserId
  )
  return {
    questionScore,
    appliedItemIds: questionScore
      ? (appliedItemIdsByQuestionScoreId.get(questionScore.id) ??
        NO_APPLIED_ITEM_IDS)
      : NO_APPLIED_ITEM_IDS,
    overridesRubric: questionScore?.overridesRubric ?? false,
  }
}

/** 点の計算に渡す形へ（採点行と、その行に当たっている項目） */
export function toRubricScoredRow(
  questionScore: QuestionScoreRow,
  appliedItemIds: ReadonlySet<string>
): RubricScoredRow {
  return {
    id: questionScore.id,
    userId: questionScore.userId,
    overridesRubric: questionScore.overridesRubric,
    status: toScoringStatus(questionScore.status),
    partialScore: questionScore.partialScore,
    rubricApplications: [...appliedItemIds].map((rubricItemId) => ({
      rubricItemId,
    })),
  }
}

/**
 * 選んだ答案に、その項目を当てるか外すか。選んだ全部に当たっていれば外し、
 * 1つでも当たっていなければ（全部に）当てる
 */
export function shouldApplyToSelection(
  rubricItemId: string,
  selectedCells: readonly OwnRubricCell[]
): boolean {
  return !selectedCells.every((cell) => cell.appliedItemIds.has(rubricItemId))
}
