/**
 * 試験（Exam）由来のrawScore算出
 * - exam_total: 全QUESTION_ANSWER CropRegionスコア合計
 * - crop_region: 単一CropRegionのスコア
 */

import { calculateActualScore } from "../../prisma/questionScore"
import type { ExamDataCache } from "./gradeCalculatorTypes"

/**
 * exam_total: 試験の全QUESTION_ANSWER CropRegionスコア合計
 */
export function calculateExamTotalScore(
  studentId: string,
  examId: string,
  examDataCache: Map<string, ExamDataCache>
): number | null {
  const examData = examDataCache.get(examId)
  if (!examData) return null

  const studentScores = examData.questionScores.filter(
    (questionScore) => questionScore.studentId === studentId
  )
  const questionRegions = examData.cropRegions.filter(
    (cropRegion) => cropRegion.type === "QUESTION_ANSWER"
  )

  let totalScore = 0
  let hasScored = false

  for (const cropRegion of questionRegions) {
    const scoreData = studentScores.find(
      (questionScore) => questionScore.cropRegionId === cropRegion.id
    )
    if (scoreData) {
      const actualScore = calculateActualScore(
        scoreData,
        cropRegion.points ?? 0
      )
      if (actualScore !== null) {
        hasScored = true
        totalScore += actualScore
      }
    }
  }

  return hasScored ? totalScore : null
}

/**
 * crop_region: 単一CropRegionのスコア取得
 */
export function calculateCropRegionScore(
  studentId: string,
  cropRegionId: string,
  examId: string,
  examDataCache: Map<string, ExamDataCache>
): number | null {
  const examData = examDataCache.get(examId)
  if (!examData) return null

  const cropRegion = examData.cropRegions.find(
    (cropRegion) => cropRegion.id === cropRegionId
  )
  if (!cropRegion) return null

  const scoreData = examData.questionScores.find(
    (questionScore) =>
      questionScore.studentId === studentId &&
      questionScore.cropRegionId === cropRegionId
  )
  if (!scoreData) return null

  return calculateActualScore(scoreData, cropRegion.points ?? 0)
}
