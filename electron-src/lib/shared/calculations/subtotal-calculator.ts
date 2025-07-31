import { getCropSubtotalsByCropRegionId } from "../../prisma/cropSubtotal"

// 小計点計算で使用する型定義
export interface SubtotalScoreDetail {
  questionId: string
  score: number | null
  maxScore: number
  status?: string
}

export interface SubtotalResult {
  score: number
  maxScore: number
}

export interface SubtotalTargetMap {
  [subtotalRegionId: string]: number[]
}

/**
 * 設問が小計点の対象かチェックする関数（詳細版）
 * GROUP内OR、GROUP間ANDのロジックを実装
 */
export async function checkIfQuestionIsInSubtotal(
  questionId: string,
  subtotalRegionId: string,
): Promise<boolean> {
  try {
    // 小計点領域に関連付けられた定義を取得
    const cropSubtotals = await getCropSubtotalsByCropRegionId(subtotalRegionId)

    if (!cropSubtotals || cropSubtotals.length === 0) {
      return false
    }

    // 簡略化されたロジック：直接的な関係をチェック
    // CropSubtotalテーブルはcropRegionIdとsubtotalIdの関係を定義している
    // 実際の実装では、subtotalに関連するcropRegionをチェック
    // 現在のところ、小計の計算対象となる設問の特定は別の方法が必要

    // TODO: 新しいスキーマでの設問-小計関係の特定方法を実装
    // 現在は、設問が小計に含まれるかのチェックは未実装
    console.warn(`checkIfQuestionIsInSubtotal not fully implemented for new schema: ${questionId} -> ${subtotalRegionId}`)
    
    return false
  } catch (error) {
    console.error(
      `Error checking if question ${questionId} is in subtotal ${subtotalRegionId}:`,
      error,
    )
    return false
  }
}

/**
 * 小計点を計算する関数（GROUP内OR、GROUP間AND）
 */
export async function calculateSubtotalScore(
  subtotalRegionId: string,
  studentScores: SubtotalScoreDetail[],
): Promise<SubtotalResult> {
  try {
    // 小計点領域に関連付けられた定義を取得
    const cropSubtotals = await getCropSubtotalsByCropRegionId(subtotalRegionId)

    if (!cropSubtotals || cropSubtotals.length === 0) {
      // フォールバック: 小計定義がない場合は全設問の合計を返す
      const totalScore = studentScores.reduce((sum, score) => sum + (score.score || 0), 0)
      const totalMaxScore = studentScores.reduce((sum, score) => sum + score.maxScore, 0)
      return { score: totalScore, maxScore: totalMaxScore }
    }

    // TODO: 新しいスキーマでの小計計算ロジックを実装
    // 現在は簡略化されたフォールバック動作
    console.warn(`calculateSubtotalScore using fallback logic for region: ${subtotalRegionId}`)
    
    const totalScore = studentScores.reduce((sum, score) => sum + (score.score || 0), 0)
    const totalMaxScore = studentScores.reduce((sum, score) => sum + score.maxScore, 0)
    return { score: totalScore, maxScore: totalMaxScore }
  } catch (error) {
    console.error(
      `Error calculating subtotal score for region ${subtotalRegionId}:`,
      error,
    )
    return { score: 0, maxScore: 0 }
  }
}

/**
 * 小計点の対象設問インデックスを事前に構築する関数
 * パフォーマンス向上のため、複数の小計点について一括で処理
 */
export async function buildSubtotalTargetMap(
  subtotalRegions: any[],
  questionRegions: any[],
): Promise<SubtotalTargetMap> {
  const subtotalTargetMap: SubtotalTargetMap = {}

  for (const subtotalRegion of subtotalRegions) {
    const targetIndices: number[] = []

    for (let i = 0; i < questionRegions.length; i++) {
      const questionRegion = questionRegions[i]
      const isTarget = await checkIfQuestionIsInSubtotal(
        questionRegion.id,
        subtotalRegion.id,
      )
      if (isTarget) {
        targetIndices.push(i)
      }
    }

    subtotalTargetMap[subtotalRegion.id] = targetIndices
    console.log(
      `Subtotal ${subtotalRegion.id} targets questions at indices: ${targetIndices.join(", ")}`,
    )
  }

  return subtotalTargetMap
}

/**
 * 小計点の対象設問インデックスを取得する関数
 */
export async function getTargetQuestionIndicesForSubtotal(
  subtotalRegionId: string,
  scores: SubtotalScoreDetail[],
): Promise<number[]> {
  const targetIndices: number[] = []

  for (let i = 0; i < scores.length; i++) {
    const score = scores[i]
    const isTarget = await checkIfQuestionIsInSubtotal(
      score.questionId,
      subtotalRegionId,
    )
    if (isTarget) {
      targetIndices.push(i)
    }
  }

  return targetIndices
}
