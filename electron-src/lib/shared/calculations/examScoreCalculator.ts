/**
 * 試験（Exam）由来のrawScore算出
 * - exam_total: 全QUESTION_ANSWER CropRegionスコア合計
 * - crop_region: 単一CropRegionのスコア
 *
 * 生徒からスコアへ到達する経路は必ず「その試験の受験者（ExamStudent）」を1回通す。
 * 受験者として登録されていない生徒はスコアを引けず、データなし（null）になる。
 */

import { calculateActualScore } from "../../prisma/questionScore"
import type { ExamDataCache, ExamStudentScores } from "./gradeCalculatorTypes"

/**
 * 生徒をその試験の受験者へ解決する。受験していなければ null。
 */
export function findExamStudentScores(
  studentId: string,
  examId: string,
  examDataCache: Map<string, ExamDataCache>
): ExamStudentScores | null {
  const examData = examDataCache.get(examId)
  if (!examData) return null
  return (
    examData.examStudents.find(
      (examStudent) => examStudent.studentId === studentId
    ) ?? null
  )
}

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

  const examStudent = findExamStudentScores(studentId, examId, examDataCache)
  if (!examStudent) return null

  const questionRegions = examData.cropRegions.filter(
    (cropRegion) => cropRegion.type === "QUESTION_ANSWER"
  )

  let totalScore = 0
  let hasScored = false

  for (const cropRegion of questionRegions) {
    const scoreData = examStudent.questionScores.find(
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

  const examStudent = findExamStudentScores(studentId, examId, examDataCache)
  if (!examStudent) return null

  const scoreData = examStudent.questionScores.find(
    (questionScore) => questionScore.cropRegionId === cropRegionId
  )
  if (!scoreData) return null

  return calculateActualScore(scoreData, cropRegion.points ?? 0)
}
