import type { CropRegion } from "@prisma/client"
import {
  getCropSubtotalsByCropRegionId,
  getCropSubtotalsBySubtotalId,
  type CropSubtotalWithSubtotal,
  type CropSubtotalWithCropRegion,
} from "../../prisma/cropSubtotal"
import { calculateActualScore } from "../../prisma/questionScore"

// 小計点計算で使用する型定義
export interface SubtotalScoreDetail {
  questionId: string
  score: number | null
  maxScore: number
  status?: string
}

// 設問スコアの型定義（PDF exportと互換性を保つため）
export interface QuestionScoreData {
  studentId: string
  cropRegionId: string
  status: string
  partialScore?: number | null
}

export interface SubtotalResult {
  score: number
  maxScore: number
}

export interface SubtotalTargetMap {
  [subtotalRegionId: string]: number[]
}

/**
 * 生徒の小計点を計算する関数（PDFエクスポートと同じロジック）
 * GROUP内OR、GROUP間ANDのロジックを完全実装
 */
export async function calculateSubtotalScoreForStudent(
  studentId: string,
  subtotalRegionId: string,
  allQuestionScores: QuestionScoreData[],
  cropRegions: CropRegion[],
): Promise<number> {
  try {
    console.log(
      `Calculating subtotal for student ${studentId}, region ${subtotalRegionId}`,
    )

    // この生徒の全採点データを取得
    const studentScores = allQuestionScores.filter(
      (score) => score.studentId === studentId,
    )

    // 小計点領域に関連付けられたグループ項目を取得
    const cropSubtotals = await getCropSubtotalsByCropRegionId(subtotalRegionId)
    console.log(`Found ${cropSubtotals?.length || 0} crop subtotals`)

    // グループ定義がない場合は、この生徒の全設問の合計点を返す（フォールバック）
    if (!cropSubtotals || cropSubtotals.length === 0) {
      console.log(
        `No crop subtotals found for region ${subtotalRegionId}, calculating total of all questions for student`,
      )
      return calculateStudentTotalScore(
        studentId,
        allQuestionScores,
        cropRegions,
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
      console.log(
        `No valid groups found, calculating total of all questions for student`,
      )
      return calculateStudentTotalScore(
        studentId,
        allQuestionScores,
        cropRegions,
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
            error,
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
          group.has(questionId),
        )
        if (existsInAllGroups) {
          finalQuestionIds.add(questionId)
        }
      }
    }

    // 該当する設問の点数を合計
    let totalScore = 0
    console.log(
      `Final question IDs for subtotal: ${Array.from(finalQuestionIds)}`,
    )

    for (const questionId of finalQuestionIds) {
      const scoreData = studentScores.find((s) => s.cropRegionId === questionId)
      if (scoreData) {
        const cropRegion = cropRegions.find((r) => r.id === questionId)
        const maxScore = cropRegion?.points || 10
        const actualScore = calculateActualScore(scoreData, maxScore)
        console.log(`Question ${questionId}: score ${actualScore}`)
        totalScore += actualScore || 0
      }
    }

    console.log(`Total subtotal score for student ${studentId}: ${totalScore}`)
    return totalScore
  } catch (error) {
    console.error(
      `Error calculating subtotal score for student ${studentId}, region ${subtotalRegionId}:`,
      error,
    )
    return 0
  }
}

/**
 * 生徒の全設問合計点を計算する（フォールバック用）
 */
function calculateStudentTotalScore(
  studentId: string,
  allQuestionScores: QuestionScoreData[],
  cropRegions: CropRegion[],
): number {
  const studentScores = allQuestionScores.filter(
    (score) => score.studentId === studentId,
  )

  let totalScore = 0
  for (const scoreData of studentScores) {
    const cropRegion = cropRegions.find((r) => r.id === scoreData.cropRegionId)
    if (cropRegion && cropRegion.type === "QUESTION_ANSWER") {
      const maxScore = cropRegion.points || 10
      const actualScore = calculateActualScore(scoreData, maxScore)
      totalScore += actualScore || 0
    }
  }

  return totalScore
}

/**
 * 小計点を計算する関数（互換性のため維持、新しい実装を推奨）
 * @deprecated Use calculateSubtotalScoreForStudent instead
 */
export async function calculateSubtotalScore(
  subtotalRegionId: string,
  studentScores: SubtotalScoreDetail[],
): Promise<SubtotalResult> {
  console.warn(
    "calculateSubtotalScore is deprecated, use calculateSubtotalScoreForStudent instead",
  )

  // フォールバック: 全設問の合計を返す
  const totalScore = studentScores.reduce(
    (sum, score) => sum + (score.score || 0),
    0,
  )
  const totalMaxScore = studentScores.reduce(
    (sum, score) => sum + score.maxScore,
    0,
  )
  return { score: totalScore, maxScore: totalMaxScore }
}

/**
 * 小計点の対象設問インデックスを事前に構築する関数
 * @deprecated This function is deprecated as it depends on old schema logic
 */
export async function buildSubtotalTargetMap(
  _subtotalRegions: CropRegion[],
  _questionRegions: CropRegion[],
): Promise<SubtotalTargetMap> {
  // 正誤一覧シートの互換性のため維持（点数一覧では使用されない）
  console.warn('buildSubtotalTargetMap is deprecated and returns empty map - subtotal scores are now calculated directly')
  return {}
}

/**
 * 小計点の対象設問インデックスを取得する関数
 * @deprecated This function is deprecated as it depends on old schema logic
 */
export async function getTargetQuestionIndicesForSubtotal(
  _subtotalRegionId: string,
  _scores: SubtotalScoreDetail[],
): Promise<number[]> {
  console.warn('getTargetQuestionIndicesForSubtotal is deprecated, use calculateSubtotalScoreForStudent instead')
  return []
}
