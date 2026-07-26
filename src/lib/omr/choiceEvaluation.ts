/**
 * 選択式（バブル）セルの判定ロジック
 *
 * main側の認識（markRecognizer）と renderer側の閾値再評価（reevaluateResults）が
 * 共有する単一実装。塗りつぶし率から「マーク済み選択肢・信頼度・採点ステータス」を導く。
 *
 * 選択肢の同定は配列の位置ではなく BubbleMeasurement が持つ choiceIndex / label で行う。
 * 位置未設定の選択肢が脱落しても添字がずれない。
 */

import type { BubbleMeasurement } from "@/types/omr.types"

export interface ChoiceEvaluationInput {
  /** バブルごとの塗りつぶし率（選択肢の同定情報を同梱） */
  bubbleMeasurements: BubbleMeasurement[]
  /** 正解の choiceIndex 集合 */
  correctChoiceIndices: number[]
  /** マーク済みと見なす塗りつぶし率の境界（0-1） */
  areaThreshold: number
}

export interface ChoiceEvaluation {
  /** 認識された選択肢ラベル */
  recognizedValues: string[]
  /** マーク済みと判定された choiceIndex */
  markedChoiceIndices: number[]
  /** 認識信頼度（0-1） */
  confidence: number
  autoScoreStatus: "correct" | "incorrect" | "no_answer" | "ambiguous"
}

/** areaThreshold での除算がゼロ割にならないための下限 */
const MIN_DIVISOR = 1e-6

/**
 * 塗りつぶし率から選択式セルの認識結果を判定する
 */
export function evaluateChoiceBubbles(
  input: ChoiceEvaluationInput
): ChoiceEvaluation {
  const { bubbleMeasurements, correctChoiceIndices, areaThreshold } = input

  if (bubbleMeasurements.length === 0) {
    return {
      recognizedValues: [],
      markedChoiceIndices: [],
      confidence: 0,
      autoScoreStatus: "no_answer",
    }
  }

  const divisor = Math.max(areaThreshold, MIN_DIVISOR)
  const marked = bubbleMeasurements.filter(
    (measurement) => measurement.fillRatio >= areaThreshold
  )
  const unmarked = bubbleMeasurements.filter(
    (measurement) => measurement.fillRatio < areaThreshold
  )

  const recognizedValues = marked.map((measurement) => measurement.label)
  const markedChoiceIndices = marked.map(
    (measurement) => measurement.choiceIndex
  )

  // 信頼度
  let confidence: number
  if (marked.length === 0) {
    // 未回答: 全て低い塗りつぶし率なら高信頼
    const maxRatio = Math.max(
      ...bubbleMeasurements.map((measurement) => measurement.fillRatio)
    )
    confidence = 1 - maxRatio / divisor
  } else if (marked.length === 1) {
    // 単一回答: マーク済みの塗りつぶし率が高いほど、他との差が大きいほど高信頼
    const markedRatio = marked[0].fillRatio
    const otherMaxRatio = Math.max(
      ...unmarked.map((measurement) => measurement.fillRatio),
      0
    )
    confidence = Math.min(markedRatio / divisor, 1 - otherMaxRatio / divisor)
  } else {
    // 複数マーク: 信頼度は低い
    confidence = 0.3
  }
  confidence = Math.max(0, Math.min(1, confidence))

  // 自動採点
  let autoScoreStatus: ChoiceEvaluation["autoScoreStatus"]
  if (marked.length === 0) {
    autoScoreStatus = "no_answer"
  } else if (marked.length > correctChoiceIndices.length) {
    autoScoreStatus = "ambiguous"
  } else {
    const isCorrect =
      marked.length === correctChoiceIndices.length &&
      markedChoiceIndices.every((choiceIndex) =>
        correctChoiceIndices.includes(choiceIndex)
      )
    autoScoreStatus = isCorrect ? "correct" : "incorrect"
  }

  return {
    recognizedValues,
    markedChoiceIndices,
    confidence,
    autoScoreStatus,
  }
}
