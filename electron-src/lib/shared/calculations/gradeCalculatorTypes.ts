/**
 * 成績算出エンジンの共有型
 * gradeCalculator / rawScoreCalculator / examScoreCalculator / absentEstimation で共有する。
 */

import type { AbsentMethod } from "../../../../src/types/grade.types"
import type { QuestionScoreForSubtotal } from "./subtotalCalculator"

/**
 * 試験ごとに事前取得したスコア・領域データ（生徒ループ外で1回だけ構築）
 */
export interface ExamDataCache {
  questionScores: QuestionScoreForSubtotal[]
  cropRegions: { id: string; type: string; points: number | null }[]
}

/**
 * 欠測推定で参照するDataSource情報（満点はライブ算出済みの値）
 */
export interface DataSourceInfo {
  id: string
  maxScore: number
  absentMethod: AbsentMethod
  absentRatio: number
  absentOffset: number
  estimationMode: string
  estimationSourceIds: string[]
}
