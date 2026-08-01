/**
 * 個人成績表の母集団データ収集ロジック。
 *
 * 平均・偏差値・順位・箱ひげ図といった統計値はここでは算出しない。renderer 側の
 * computeReportData が受験状態フィルタを適用して算出する。
 */

import type { ExamStudentStatus } from "@/types/examStudentStatus.types"

import type { ScoringData } from "../../shared/types"
import type {
  RawTotalScoreEntry,
  ReportSubtotal,
  SubtotalRawScores,
} from "./types"

/**
 * 設問別正答率を計算
 */
export function calculateQuestionCorrectRates(
  allScoringData: ScoringData[]
): Record<string, number> {
  const rates: Record<string, number> = {}

  if (allScoringData.length === 0) return rates

  // 最初の生徒から設問リストを取得
  const questionIds = allScoringData[0].scores.map((score) => score.questionId)

  for (const questionId of questionIds) {
    let correctCount = 0
    let totalCount = 0

    for (const scoringData of allScoringData) {
      const score = scoringData.scores.find(
        (questionScore) => questionScore.questionId === questionId
      )
      if (score && score.status !== "unscored") {
        totalCount++
        if (score.status === "correct") {
          correctCount++
        }
      }
    }

    rates[questionId] = totalCount > 0 ? (correctCount / totalCount) * 100 : 0
  }

  return rates
}

/**
 * 設問別得点率を計算
 * 各生徒の得点/配点の平均（部分点を比例的に反映）
 */
export function calculateQuestionScoreRates(
  allScoringData: ScoringData[]
): Record<string, number> {
  const rates: Record<string, number> = {}

  if (allScoringData.length === 0) return rates

  const questionIds = allScoringData[0].scores.map((score) => score.questionId)

  for (const questionId of questionIds) {
    let scoreSum = 0
    let totalCount = 0

    for (const scoringData of allScoringData) {
      const score = scoringData.scores.find(
        (questionScore) => questionScore.questionId === questionId
      )
      if (score && score.status !== "unscored" && score.maxScore > 0) {
        totalCount++
        scoreSum += (score.score ?? 0) / score.maxScore
      }
    }

    rates[questionId] = totalCount > 0 ? (scoreSum / totalCount) * 100 : 0
  }

  return rates
}

/**
 * 全受験者の合計点を収集する（統計の母集団）。
 *
 * ここが人（Student）キーなのは正しい。突き合わせ相手が学級の在籍者一覧
 * （StudentClassroomMembership＝人の所属）だからで、受験者（ExamStudent）では
 * 学級の母集団と噛み合わない（#962 §3.3 の棚卸し結果）。
 */
export function collectRawTotalScores(
  allScoringData: ScoringData[]
): RawTotalScoreEntry[] {
  return allScoringData.map((scoringData) => ({
    studentId: scoringData.studentId,
    totalScore: scoringData.totalScore,
    status: scoringData.status || ("participating" as const),
  }))
}

/**
 * 小計の識別・表示情報を収集する
 * SubtotalScoreから直接グループ情報を取得（CropRegion経由のマッピング不要）
 */
export function collectReportSubtotals(
  allScoringData: ScoringData[]
): ReportSubtotal[] {
  if (allScoringData.length === 0) return []

  // 小計の構成は全受験者で共通なので、最初の1人から取れば足りる
  return allScoringData[0].subtotalScores.map((subtotalScore) => ({
    subtotalId: subtotalScore.subtotalId,
    subtotalLabel: subtotalScore.subtotalLabel,
    maxScore: subtotalScore.maxScore,
    subtotalGroupId: subtotalScore.subtotalGroupId,
  }))
}

/**
 * 小計別生スコアデータを収集（renderer側での統計算出用）
 * 各小計ごとに全生徒のスコアと受験状態を収集
 */
export function collectSubtotalRawScores(
  allScoringData: ScoringData[]
): SubtotalRawScores[] {
  if (
    allScoringData.length === 0 ||
    allScoringData[0].subtotalScores.length === 0
  ) {
    return []
  }

  // 最初の生徒から小計点リストを取得
  const subtotalTemplate = allScoringData[0].subtotalScores

  return subtotalTemplate.map((template) => {
    const scores = allScoringData
      .map((scoringData) => {
        const subtotal = scoringData.subtotalScores.find(
          (subtotalScore) => subtotalScore.subtotalId === template.subtotalId
        )
        if (!subtotal || subtotal.score === null) return null
        return {
          studentId: scoringData.studentId,
          score: subtotal.score,
          status: scoringData.status || ("participating" as const),
        }
      })
      .filter(
        (
          entry
        ): entry is {
          studentId: string
          score: number
          status: ExamStudentStatus
        } => entry !== null
      )

    return {
      subtotalId: template.subtotalId,
      scores,
    }
  })
}
