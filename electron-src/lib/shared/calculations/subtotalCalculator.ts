import type { CropRegion, QuestionScore } from "@prisma/client"

import {
  type CropSubtotalWithCropRegion,
  type CropSubtotalWithSubtotal,
  getCropSubtotalsByCropRegionId,
  getCropSubtotalsBySubtotalId,
} from "../../prisma/cropSubtotal"
import { calculateActualScore } from "../../prisma/questionScore"

// 小計点計算で使用する型定義
export interface SubtotalScoreDetail {
  questionId: string
  score: number | null
  maxScore: number
  status?: string
}

/**
 * 小計計算の入力となる、解決済み設問スコアの最小射影（生徒×設問の得点1件）。
 * identity フィールドは QuestionScore に追随。status は calculateActualScore が
 * 旧値（final/proposed）を特別扱いするため String のまま広く保つ。
 */
export type QuestionScoreForSubtotal = Omit<
  QuestionScore,
  "id" | "userId" | "createdAt" | "updatedAt" | "partialScore"
> & { partialScore?: number | null }

export interface SubtotalScoreResult {
  score: number | null
  maxScore: number
  /** QUESTION_ASSIGNMENTが存在するか */
  hasQuestionAssignments: boolean
}

/**
 * 生徒の小計点を計算する関数（PDFエクスポートと同じロジック）
 * GROUP内OR、GROUP間ANDのロジックを完全実装
 *
 * @returns スコアと最大点の両方を返す
 */
export async function calculateSubtotalScoreForStudent(
  studentId: string,
  subtotalRegionId: string,
  allQuestionScores: QuestionScoreForSubtotal[],
  cropRegions: CropRegion[]
): Promise<SubtotalScoreResult> {
  try {
    // この生徒の全採点データを取得
    const studentScores = allQuestionScores.filter(
      (score) => score.studentId === studentId
    )

    // 小計点領域に関連付けられたグループ項目を取得
    const cropSubtotals = await getCropSubtotalsByCropRegionId(subtotalRegionId)

    // グループ定義がない場合は、この生徒の全設問の合計点を返す（フォールバック）
    if (!cropSubtotals || cropSubtotals.length === 0) {
      return calculateStudentTotalScoreWithMax(
        studentId,
        allQuestionScores,
        cropRegions
      )
    }

    // グループ別に項目をまとめる
    const groupMap = new Map<string, string[]>()

    for (const cropSubtotal of cropSubtotals as CropSubtotalWithSubtotal[]) {
      if (!cropSubtotal || typeof cropSubtotal !== "object") continue

      const groupId = cropSubtotal.subtotal?.subtotalGroupId
      if (!groupId) continue

      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, [])
      }
      groupMap.get(groupId)!.push(cropSubtotal.subtotalId)
    }

    if (groupMap.size === 0) {
      return calculateStudentTotalScoreWithMax(
        studentId,
        allQuestionScores,
        cropRegions
      )
    }

    // 各グループで該当する設問を取得（GROUP内OR）
    const groupQuestionSets: Set<string>[] = []

    for (const [_groupId, itemIds] of groupMap) {
      const groupQuestionIds = new Set<string>()

      // 各項目に関連付けられた設問を取得
      for (const itemId of itemIds) {
        try {
          const itemCropSubtotals = await getCropSubtotalsBySubtotalId(itemId)
          if (itemCropSubtotals && itemCropSubtotals.length > 0) {
            for (const cropSubtotal of itemCropSubtotals as CropSubtotalWithCropRegion[]) {
              if (cropSubtotal.assignmentType === "QUESTION_ASSIGNMENT") {
                groupQuestionIds.add(cropSubtotal.cropRegionId)
              }
            }
          }
        } catch (error) {
          console.error(
            `Error getting crop subtotals for item ${itemId}:`,
            error
          )
        }
      }

      groupQuestionSets.push(groupQuestionIds)
    }

    // GROUP間AND：全てのグループに共通する設問を取得
    let finalQuestionIds: Set<string>
    if (groupQuestionSets.length === 1) {
      finalQuestionIds = groupQuestionSets[0]
    } else {
      finalQuestionIds = new Set()
      const firstGroup = groupQuestionSets[0]

      for (const questionId of firstGroup) {
        const existsInAllGroups = groupQuestionSets.every((group) =>
          group.has(questionId)
        )
        if (existsInAllGroups) {
          finalQuestionIds.add(questionId)
        }
      }
    }

    // 該当する設問の点数と最大点を合計
    // scoreDataがある設問のみを対象にする（scoreと同じ設問）
    let totalScore = 0
    let totalMaxScore = 0
    let hasScoredQuestion = false

    for (const questionId of finalQuestionIds) {
      const scoreData = studentScores.find(
        (questionScore) => questionScore.cropRegionId === questionId
      )
      if (scoreData) {
        const cropRegion = cropRegions.find(
          (cropRegion) => cropRegion.id === questionId
        )
        const questionMaxScore = cropRegion?.points || 0
        totalMaxScore += questionMaxScore
        const actualScore = calculateActualScore(scoreData, questionMaxScore)
        if (actualScore !== null) {
          hasScoredQuestion = true
          totalScore += actualScore
        }
      }
    }

    return {
      score: hasScoredQuestion ? totalScore : null,
      maxScore: totalMaxScore,
      hasQuestionAssignments: true,
    }
  } catch (error) {
    console.error(
      `Error calculating subtotal score for student ${studentId}, region ${subtotalRegionId}:`,
      error
    )
    return { score: null, maxScore: 0, hasQuestionAssignments: false }
  }
}

/**
 * 生徒の全設問合計点とその最大点を計算する（フォールバック用）
 */
function calculateStudentTotalScoreWithMax(
  studentId: string,
  allQuestionScores: QuestionScoreForSubtotal[],
  cropRegions: CropRegion[]
): SubtotalScoreResult {
  const studentScores = allQuestionScores.filter(
    (score) => score.studentId === studentId
  )

  let totalScore = 0
  let totalMaxScore = 0
  let hasScoredQuestion = false

  // 全設問領域から最大点を計算（採点データの有無に関わらず）
  for (const region of cropRegions) {
    if (region.type === "QUESTION_ANSWER") {
      totalMaxScore += region.points || 10
    }
  }

  // 採点データがある設問の得点を合計
  for (const scoreData of studentScores) {
    const cropRegion = cropRegions.find(
      (cropRegion) => cropRegion.id === scoreData.cropRegionId
    )
    if (cropRegion && cropRegion.type === "QUESTION_ANSWER") {
      const maxScore = cropRegion.points || 10
      const actualScore = calculateActualScore(scoreData, maxScore)
      if (actualScore !== null) {
        hasScoredQuestion = true
        totalScore += actualScore
      }
    }
  }

  return {
    score: hasScoredQuestion ? totalScore : null,
    maxScore: totalMaxScore,
    hasQuestionAssignments: true,
  }
}

/**
 * Subtotal IDから直接小計点を計算する関数（個人成績表用）
 * SUBTOTAL_SCORE CropRegionを介さず、Subtotalから直接計算
 *
 * @param studentId 生徒ID
 * @param subtotalId Subtotal ID
 * @param allQuestionScores 全採点データ
 * @param cropRegions 全CropRegion（QUESTION_ANSWER用）
 * @returns 小計点と最大点
 */
export async function calculateSubtotalScoreBySubtotalId(
  studentId: string,
  subtotalId: string,
  allQuestionScores: QuestionScoreForSubtotal[],
  cropRegions: CropRegion[]
): Promise<SubtotalScoreResult> {
  try {
    // この生徒の全採点データを取得
    const studentScores = allQuestionScores.filter(
      (score) => score.studentId === studentId
    )

    // SubtotalからQUESTION_ASSIGNMENTのCropSubtotalを直接取得
    const cropSubtotals = await getCropSubtotalsBySubtotalId(subtotalId)

    // QUESTION_ASSIGNMENTタイプのみをフィルタリング
    const allQuestionAssignments = (
      cropSubtotals as CropSubtotalWithCropRegion[]
    ).filter(
      (cropSubtotal) => cropSubtotal.assignmentType === "QUESTION_ASSIGNMENT"
    )

    // 現在の試験のCropRegion IDでフィルタリング
    // （SubtotalGroupは複数試験で共有されるため）
    const examCropRegionIds = new Set(
      cropRegions.map((cropRegion) => cropRegion.id)
    )
    const questionAssignments = allQuestionAssignments.filter((cropSubtotal) =>
      examCropRegionIds.has(cropSubtotal.cropRegionId)
    )

    const hasQuestionAssignments = questionAssignments.length > 0

    if (!hasQuestionAssignments) {
      return { score: null, maxScore: 0, hasQuestionAssignments: false }
    }

    // 関連するQUESTION_ANSWER CropRegion IDを取得
    const questionCropRegionIds = new Set(
      questionAssignments.map((cropSubtotal) => cropSubtotal.cropRegionId)
    )

    // 該当する設問の点数と最大点を合計
    let totalScore = 0
    let totalMaxScore = 0
    let hasScoredQuestion = false

    for (const questionId of questionCropRegionIds) {
      const cropRegion = cropRegions.find(
        (cropRegion) => cropRegion.id === questionId
      )
      if (!cropRegion || cropRegion.type !== "QUESTION_ANSWER") continue

      const questionMaxScore = cropRegion.points || 0
      totalMaxScore += questionMaxScore

      const scoreData = studentScores.find(
        (questionScore) => questionScore.cropRegionId === questionId
      )
      if (scoreData) {
        const actualScore = calculateActualScore(scoreData, questionMaxScore)
        if (actualScore !== null) {
          hasScoredQuestion = true
          totalScore += actualScore
        }
      }
    }

    return {
      score: hasScoredQuestion ? totalScore : null,
      maxScore: totalMaxScore,
      hasQuestionAssignments: true,
    }
  } catch (error) {
    console.error(
      `Error calculating subtotal score for student ${studentId}, subtotal ${subtotalId}:`,
      error
    )
    return { score: null, maxScore: 0, hasQuestionAssignments: false }
  }
}
