/**
 * 選択式（バブル）セルの判定ロジック
 *
 * main側の認識（markRecognizer）と renderer側の閾値再評価（reevaluateResults）が
 * 共有する単一実装。バブルの塗り具合から
 * 「マーク済み選択肢・信頼度・採点ステータス」を導く。
 *
 * 選択肢の同定は配列の位置ではなく BubbleMeasurement が持つ choiceIndex / label で行う。
 * 位置未設定の選択肢が脱落しても添字がずれない。
 */

import type { BubbleMeasurement } from "@/types/omr.types"

interface ChoiceEvaluationInput {
  /** バブルごとの塗り具合（選択肢の同定情報を同梱） */
  bubbleMeasurements: BubbleMeasurement[]
  /** 正解の choiceIndex 集合 */
  correctChoiceIndices: number[]
  /** マーク済みと見なす塗りつぶし率の境界（0-1） */
  areaThreshold: number
  /**
   * マークと見なす濃さの下限（0-1）。これを下回る塗りは消し跡として退ける。
   *
   * 答案群の濃さの分布から算出する値で、null なら濃さによる棄却をしない。
   * 絶対値で固定してはいけない: 「薄い」は鉛筆とスキャナ次第で、
   * 薄いマークを拾えるようにする色しきい値の自動決定と正面から衝突する。
   */
  minInkDarkness: number | null
}

interface ChoiceEvaluation {
  /** 認識された選択肢ラベル */
  recognizedValues: string[]
  /** マーク済みと判定された choiceIndex */
  markedChoiceIndices: number[]
  /** 塗りつぶし率は閾値を超えたが、消し跡と判断して退けた choiceIndex */
  residueChoiceIndices: number[]
  /** 認識信頼度（0-1） */
  confidence: number
  autoScoreStatus: "correct" | "incorrect" | "no_answer" | "ambiguous"
}

/** areaThreshold での除算がゼロ割にならないための下限 */
const MIN_DIVISOR = 1e-6

/** 中心が塗られていると見なす最低の塗りつぶし率 */
const MIN_CENTER_COVERAGE = 0.15

/**
 * 輪郭をなぞったと見なす最低の縁の塗りつぶし率
 *
 * なぞった線は縁をぐるりと覆う。紙のノイズ程度の汚れは縁の一部にしか乗らない。
 * 濃さと違って縮尺に依らない幾何的な量なので、固定値でよい。
 */
const MIN_RIM_COVERAGE = 0.5

/**
 * 消し跡を退けたセルに許す信頼度の上限
 *
 * 退けた判断が確かなものではないことを信頼度に反映する。
 * ただし保留への降格自体は信頼度に頼らず、消し跡の有無で直接決める
 * （信頼度閾値はユーザーが0まで下げられるうえ、未回答は低信頼チェックの対象外）。
 */
const MAX_CONFIDENCE_WITH_RESIDUE = 0.6

/**
 * 塗り具合から選択式セルの認識結果を判定する
 */
export function evaluateChoiceBubbles(
  input: ChoiceEvaluationInput
): ChoiceEvaluation {
  const {
    bubbleMeasurements,
    correctChoiceIndices,
    areaThreshold,
    minInkDarkness,
  } = input

  if (bubbleMeasurements.length === 0) {
    return {
      recognizedValues: [],
      markedChoiceIndices: [],
      residueChoiceIndices: [],
      confidence: 0,
      autoScoreStatus: "no_answer",
    }
  }

  const divisor = Math.max(areaThreshold, MIN_DIVISOR)

  // 塗りつぶし率が閾値を超えたバブルのうち、消し跡と判断したものを退ける
  const exceeded = bubbleMeasurements.filter(
    (measurement) => measurement.fillRatio >= areaThreshold
  )
  const residue = exceeded.filter((measurement) =>
    isEraserResidue(measurement, minInkDarkness)
  )
  const marked = exceeded.filter(
    (measurement) => !isEraserResidue(measurement, minInkDarkness)
  )
  // 閾値に届かなかったバブル。消し跡は「競合するマーク」ではないので含めない
  const belowThreshold = bubbleMeasurements.filter(
    (measurement) => measurement.fillRatio < areaThreshold
  )

  const recognizedValues = marked.map((measurement) => measurement.label)
  const markedChoiceIndices = marked.map(
    (measurement) => measurement.choiceIndex
  )

  // 信頼度
  let confidence: number
  if (marked.length === 0) {
    // 未回答: 全て低い塗りつぶし率なら高信頼。
    // 消し跡として退けたバブルがあれば閾値超えの値が入るので信頼度は0に落ちる
    const maxRatio = Math.max(
      ...bubbleMeasurements.map((measurement) => measurement.fillRatio)
    )
    confidence = 1 - maxRatio / divisor
  } else if (marked.length === 1) {
    // 単一回答: マーク済みの塗りつぶし率が高いほど、他との差が大きいほど高信頼
    const markedRatio = marked[0].fillRatio
    const otherMaxRatio = Math.max(
      ...belowThreshold.map((measurement) => measurement.fillRatio),
      0
    )
    confidence = Math.min(markedRatio / divisor, 1 - otherMaxRatio / divisor)
  } else {
    // 複数マーク: 信頼度は低い
    confidence = 0.3
  }
  if (residue.length > 0) {
    confidence = Math.min(confidence, MAX_CONFIDENCE_WITH_RESIDUE)
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
    residueChoiceIndices: residue.map((measurement) => measurement.choiceIndex),
    confidence,
    autoScoreStatus,
  }
}

/**
 * 塗りつぶし率が閾値を超えたバブルを消し跡と判断するか
 *
 * 塗りつぶし率は「どれだけの面積が暗いか」しか見ないので、薄く広がった消し跡でも
 * 閾値を超えうる。濃さと中心の塗られ方という別の軸を足して切り分ける。
 *
 * どちらか一方でも該当すれば退ける。両方を要求すると、一様に薄く広がった消し跡
 * （中心も塗られている）を取り逃がす。
 */
function isEraserResidue(
  measurement: BubbleMeasurement,
  minInkDarkness: number | null
): boolean {
  // 答案群の中で明らかに薄い: 消しゴムで消した跡に残る黒鉛
  if (minInkDarkness !== null && measurement.inkDarkness < minInkDarkness) {
    return true
  }

  // 中心が空なのに縁はぐるりと覆われている:
  // バブルの輪郭をなぞった線や枠のにじみ。
  // 濃さと違って縮尺に依らないので、分布が得られなくても常に効かせる。
  //
  // 縁にも覆われ具合を要求するのは、塗りつぶし判定閾値を下げたときに
  // 紙のノイズ程度の汚れまで消し跡として退けないため
  if (
    measurement.innerFillRatio < MIN_CENTER_COVERAGE &&
    measurement.rimFillRatio >= MIN_RIM_COVERAGE
  ) {
    return true
  }

  return false
}
