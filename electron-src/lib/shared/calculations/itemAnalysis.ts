/**
 * 項目分析（item analysis）の純粋計算ロジック（#833）
 *
 * Excel「問題分析」シートと出力プレビューの双方から利用するため、Node/Electron依存を
 * 持たない純関数のみで構成する。入力は最小形（{@link ItemAnalysisInputStudent}）へ正規化して渡す。
 *
 * 設計メモ:
 * - 欠測（未採点・保留など score===null）の判定は **score===null** に統一する。
 *   - `no_answer`/`double_mark` は確定的に0点なので欠測ではなく0として母集団に含む。
 *   - `unscored` と未確定の `hold`/`pending`（partialScore 未設定で score===null）は欠測として除外。
 * - 識別係数・D値・α は **complete-case**（全設問が採点済み = 全 score 非null の生徒）で算出する。
 *   採点途中の合計点（未採点を0と合算した値）で順位付けして母集団が歪むのを防ぐ。
 * - 個人成績表向けの `statisticsCalculator.ts`（`calculateDiscriminationIndices` 等）とは
 *   消費者・集計セマンティクスが異なるため別実装。こちらは「シートとプレビューの一致」を担保する。
 */

import type { DiscriminationLevel } from "../types"

/** 設問1問分の生徒応答（正規化済み） */
export interface ItemAnalysisInputItem {
  questionId: string
  label: string
  maxScore: number
  /** 得点。欠測（未採点・未確定）は null */
  score: number | null
  /** 正答（status === "correct"）なら true */
  isCorrect: boolean
}

/** 生徒1人分の入力 */
export interface ItemAnalysisInputStudent {
  items: ItemAnalysisInputItem[]
}

/** 設問1問分の分析結果 */
export interface ItemAnalysisItem {
  questionId: string
  label: string
  maxScore: number
  /** 正答率(%) */
  correctRate: number
  /** 得点率(%) */
  scoreRate: number
  /** 識別係数（補正済み項目合計相関、complete-case）。判定不可は null */
  discriminationIndex: number | null
  discriminationLevel: DiscriminationLevel
  /** D値（上位/下位27%群の得点率差、complete-case）。判定不可は null */
  dValue: number | null
  dValueLevel: DiscriminationLevel
}

export interface ItemAnalysisResult {
  items: ItemAnalysisItem[]
  /** クロンバックのα係数（テスト全体の信頼性係数）。判定不可は null */
  cronbachAlpha: number | null
  /** complete-case（全設問採点済み）生徒数 */
  completeCaseCount: number
}

/** 識別係数・D値の判定帯（0.2/0.3/0.4） */
function getDiscriminationLevel(r: number | null): DiscriminationLevel {
  if (r === null) return "insufficient"
  if (r < 0) return "negative"
  if (r < 0.2) return "poor"
  if (r < 0.3) return "marginal"
  if (r < 0.4) return "acceptable"
  return "good"
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** 母標準偏差（n で割る） */
function stdDev(values: number[]): number {
  if (values.length === 0) return 0
  const avg = average(values)
  return Math.sqrt(average(values.map((value) => (value - avg) ** 2)))
}

/**
 * 正規化済み入力から項目分析（正答率・得点率・識別係数・D値・α）を一括算出する。
 * 生徒0人・設問0問なら null。
 */
export function computeItemAnalysis(
  students: ItemAnalysisInputStudent[]
): ItemAnalysisResult | null {
  if (students.length === 0) return null

  const questions = students[0].items.map((item) => ({
    questionId: item.questionId,
    label: item.label,
    maxScore: item.maxScore,
  }))
  const k = questions.length
  if (k === 0) return null

  // 各生徒の設問→item を Map 化（O(生徒×k) に抑える）
  const studentMaps = students.map((student) => {
    const itemMap = new Map<string, ItemAnalysisInputItem>()
    for (const item of student.items) itemMap.set(item.questionId, item)
    return itemMap
  })

  // complete-case: 全設問が採点済み（全 score 非null）の生徒
  const completeMaps = studentMaps.filter((studentMap) =>
    questions.every(
      (question) =>
        (studentMap.get(question.questionId)?.score ?? null) !== null
    )
  )
  const completeCaseCount = completeMaps.length

  // complete-case の合計点（行和）
  const completeTotals = completeMaps.map((studentMap) =>
    questions.reduce(
      (sum, question) =>
        sum + (studentMap.get(question.questionId)?.score ?? 0),
      0
    )
  )

  // D値: complete-case を合計点降順に並べ上位/下位27%群の得点率差
  const order = completeMaps
    .map((_, i) => i)
    .sort((a, b) => completeTotals[b] - completeTotals[a])
  const groupSize = Math.round(completeMaps.length * 0.27)
  const upperIdx = order.slice(0, groupSize)
  const lowerIdx = order.slice(order.length - groupSize)

  const groupScoreRate = (
    idxs: number[],
    questionId: string,
    maxScore: number
  ): number | null => {
    if (maxScore <= 0) return null
    const rates: number[] = []
    for (const completeMapIndex of idxs) {
      const score = completeMaps[completeMapIndex].get(questionId)?.score
      if (score == null) continue
      rates.push(score / maxScore)
    }
    return rates.length > 0 ? average(rates) : null
  }

  const items: ItemAnalysisItem[] = questions.map((question) => {
    // 正答率・得点率（score 非null の生徒を母数）
    let correctCount = 0
    let scoredCount = 0
    let scoreRateSum = 0
    for (const studentMap of studentMaps) {
      const item = studentMap.get(question.questionId)
      if (!item || item.score === null) continue
      scoredCount++
      if (item.isCorrect) correctCount++
      if (question.maxScore > 0) scoreRateSum += item.score / question.maxScore
    }
    const correctRate = scoredCount > 0 ? (correctCount / scoredCount) * 100 : 0
    const scoreRate = scoredCount > 0 ? (scoreRateSum / scoredCount) * 100 : 0

    // 識別係数（complete-case の補正済み項目合計相関）
    let discriminationIndex: number | null = null
    if (completeMaps.length >= 3) {
      const itemScores: number[] = []
      const correctedTotals: number[] = []
      completeMaps.forEach((m, i) => {
        const score = m.get(question.questionId)?.score ?? 0
        itemScores.push(score)
        correctedTotals.push(completeTotals[i] - score)
      })
      const itemSd = stdDev(itemScores)
      const totalSd = stdDev(correctedTotals)
      if (itemSd > 0 && totalSd > 0) {
        const itemMean = average(itemScores)
        const totalMean = average(correctedTotals)
        let cov = 0
        for (let i = 0; i < itemScores.length; i++) {
          cov += (itemScores[i] - itemMean) * (correctedTotals[i] - totalMean)
        }
        cov /= itemScores.length
        discriminationIndex = cov / (itemSd * totalSd)
      }
    }

    // D値（得点率差）
    let dValue: number | null = null
    if (groupSize >= 1) {
      const up = groupScoreRate(
        upperIdx,
        question.questionId,
        question.maxScore
      )
      const low = groupScoreRate(
        lowerIdx,
        question.questionId,
        question.maxScore
      )
      dValue = up !== null && low !== null ? up - low : null
    }

    return {
      questionId: question.questionId,
      label: question.label,
      maxScore: question.maxScore,
      correctRate,
      scoreRate,
      discriminationIndex,
      discriminationLevel: getDiscriminationLevel(discriminationIndex),
      dValue,
      dValueLevel: getDiscriminationLevel(dValue),
    }
  })

  const cronbachAlpha = computeCronbachAlpha(
    completeMaps,
    completeTotals,
    questions
  )

  return { items, cronbachAlpha, completeCaseCount }
}

/**
 * クロンバックのα係数（complete-case・母分散）。
 * k<2 / 対象<3人 / 合計点分散0 で null。
 */
function computeCronbachAlpha(
  completeMaps: Map<string, ItemAnalysisInputItem>[],
  completeTotals: number[],
  questions: { questionId: string }[]
): number | null {
  const k = questions.length
  if (k < 2) return null
  if (completeMaps.length < 3) return null

  let sumItemVariance = 0
  for (const question of questions) {
    const itemScores = completeMaps.map(
      (studentMap) => studentMap.get(question.questionId)?.score ?? 0
    )
    sumItemVariance += stdDev(itemScores) ** 2
  }
  const totalVariance = stdDev(completeTotals) ** 2
  if (totalVariance === 0) return null

  return (k / (k - 1)) * (1 - sumItemVariance / totalVariance)
}
