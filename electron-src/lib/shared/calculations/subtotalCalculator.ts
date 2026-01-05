import type { CropRegion } from "@prisma/client"
import {
  getCropSubtotalsByCropRegionId,
  getCropSubtotalsBySubtotalId,
  type CropSubtotalWithCropRegion,
  type CropSubtotalWithSubtotal,
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

export interface SubtotalScoreResult {
  score: number
  maxScore: number
  /** QUESTION_ASSIGNMENTが存在するか */
  hasQuestionAssignments: boolean
}

export interface SubtotalTargetMap {
  [subtotalRegionId: string]: number[]
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
  allQuestionScores: QuestionScoreData[],
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

    for (const questionId of finalQuestionIds) {
      const scoreData = studentScores.find((s) => s.cropRegionId === questionId)
      if (scoreData) {
        const cropRegion = cropRegions.find((r) => r.id === questionId)
        const questionMaxScore = cropRegion?.points || 0
        totalMaxScore += questionMaxScore
        const actualScore = calculateActualScore(scoreData, questionMaxScore)
        totalScore += actualScore || 0
      }
    }

    return {
      score: totalScore,
      maxScore: totalMaxScore,
      hasQuestionAssignments: true,
    }
  } catch (error) {
    console.error(
      `Error calculating subtotal score for student ${studentId}, region ${subtotalRegionId}:`,
      error
    )
    return { score: 0, maxScore: 0, hasQuestionAssignments: false }
  }
}

/**
 * 生徒の全設問合計点とその最大点を計算する（フォールバック用）
 */
function calculateStudentTotalScoreWithMax(
  studentId: string,
  allQuestionScores: QuestionScoreData[],
  cropRegions: CropRegion[]
): SubtotalScoreResult {
  const studentScores = allQuestionScores.filter(
    (score) => score.studentId === studentId
  )

  let totalScore = 0
  let totalMaxScore = 0

  // 全設問領域から最大点を計算（採点データの有無に関わらず）
  for (const region of cropRegions) {
    if (region.type === "QUESTION_ANSWER") {
      totalMaxScore += region.points || 10
    }
  }

  // 採点データがある設問の得点を合計
  for (const scoreData of studentScores) {
    const cropRegion = cropRegions.find((r) => r.id === scoreData.cropRegionId)
    if (cropRegion && cropRegion.type === "QUESTION_ANSWER") {
      const maxScore = cropRegion.points || 10
      const actualScore = calculateActualScore(scoreData, maxScore)
      totalScore += actualScore || 0
    }
  }

  return {
    score: totalScore,
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
  allQuestionScores: QuestionScoreData[],
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
    ).filter((cs) => cs.assignmentType === "QUESTION_ASSIGNMENT")

    // 現在のプロジェクトのCropRegion IDでフィルタリング
    // （SubtotalGroupは複数プロジェクトで共有されるため）
    const projectCropRegionIds = new Set(cropRegions.map((r) => r.id))
    const questionAssignments = allQuestionAssignments.filter((cs) =>
      projectCropRegionIds.has(cs.cropRegionId)
    )

    const hasQuestionAssignments = questionAssignments.length > 0

    if (!hasQuestionAssignments) {
      return { score: 0, maxScore: 0, hasQuestionAssignments: false }
    }

    // 関連するQUESTION_ANSWER CropRegion IDを取得
    const questionCropRegionIds = new Set(
      questionAssignments.map((cs) => cs.cropRegionId)
    )

    // 該当する設問の点数と最大点を合計
    let totalScore = 0
    let totalMaxScore = 0

    for (const questionId of questionCropRegionIds) {
      const cropRegion = cropRegions.find((r) => r.id === questionId)
      if (!cropRegion || cropRegion.type !== "QUESTION_ANSWER") continue

      const questionMaxScore = cropRegion.points || 0
      totalMaxScore += questionMaxScore

      const scoreData = studentScores.find((s) => s.cropRegionId === questionId)
      if (scoreData) {
        const actualScore = calculateActualScore(scoreData, questionMaxScore)
        totalScore += actualScore || 0
      }
    }

    return {
      score: totalScore,
      maxScore: totalMaxScore,
      hasQuestionAssignments: true,
    }
  } catch (error) {
    console.error(
      `Error calculating subtotal score for student ${studentId}, subtotal ${subtotalId}:`,
      error
    )
    return { score: 0, maxScore: 0, hasQuestionAssignments: false }
  }
}

/**
 * 小計点の対象設問インデックスを事前に構築する関数
 * @deprecated This function is deprecated as it depends on old schema logic
 */
export async function buildSubtotalTargetMap(
  _subtotalRegions: CropRegion[],
  _questionRegions: CropRegion[]
): Promise<SubtotalTargetMap> {
  // 正誤一覧シートの互換性のため維持（点数一覧では使用されない）
  console.warn(
    "buildSubtotalTargetMap is deprecated and returns empty map - subtotal scores are now calculated directly"
  )
  return {}
}
