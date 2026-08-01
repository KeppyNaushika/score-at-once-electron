/**
 * 小計点の算出。
 *
 * 純粋関数（compute*）と、DB から割り当てを引いてから委譲する薄いラッパ（calculate*）に
 * 分かれる。純粋側は prisma に触れないので renderer からも呼べる。
 */

import type { QuestionScore } from "@prisma/client"

import {
  type CropSubtotalWithSubtotal,
  getCropSubtotalsByCropRegionId,
  getQuestionAssignmentsBySubtotalIds,
} from "../../prisma/cropSubtotal"
import { calculateActualScore } from "./actualScore"

/**
 * 小計計算の入力となる、解決済み設問スコアの最小射影（生徒×設問の得点1件）。
 * identity フィールドは QuestionScore に追随。status は calculateActualScore が
 * 旧値（final/proposed）を特別扱いするため String のまま広く保つ。
 */
export type QuestionScoreForSubtotal = Omit<
  QuestionScore,
  "id" | "userId" | "createdAt" | "updatedAt" | "partialScore"
> & { partialScore?: number | null }

/**
 * 小計計算が読む設問領域の最小射影。
 *
 * Prisma の `CropRegion` はそのまま渡せる。成績算出は事前取得したキャッシュから
 * この3列だけを持つので、全列を要求すると呼び出し側に `as` を強いることになる。
 */
export interface CropRegionForSubtotal {
  id: string
  type: string
  points: number | null
}

/**
 * 小計 id → その小計に割り当てられた設問領域 id。
 *
 * SubtotalGroup は複数の試験で共有されうるので、ここには他の試験の設問領域 id も
 * 混ざる。当該試験の分へ絞り込むのは算出側の責務（`cropRegions` と突き合わせる）。
 */
export type QuestionAssignmentsBySubtotalId = Map<string, string[]>

interface SubtotalScoreResult {
  score: number | null
  maxScore: number
  /** QUESTION_ASSIGNMENTが存在するか */
  hasQuestionAssignments: boolean
}

/**
 * 小計点を算出する（純粋）。
 *
 * @param assignedCropRegionIds その小計に割り当てられた設問領域 id（他試験の分を含む）
 */
export function computeSubtotalScore(
  examStudentId: string,
  allQuestionScores: QuestionScoreForSubtotal[],
  cropRegions: CropRegionForSubtotal[],
  assignedCropRegionIds: string[]
): SubtotalScoreResult {
  const examStudentScores = allQuestionScores.filter(
    (questionScore) => questionScore.examStudentId === examStudentId
  )

  // 現在の試験の CropRegion に限る（SubtotalGroup は複数試験で共有されるため）
  const examCropRegionIds = new Set(
    cropRegions.map((cropRegion) => cropRegion.id)
  )
  const questionCropRegionIds = assignedCropRegionIds.filter((cropRegionId) =>
    examCropRegionIds.has(cropRegionId)
  )

  if (questionCropRegionIds.length === 0) {
    return { score: null, maxScore: 0, hasQuestionAssignments: false }
  }

  // 該当する設問の点数と最大点を合計
  let totalScore = 0
  let totalMaxScore = 0
  let hasScoredQuestion = false

  for (const questionCropRegionId of new Set(questionCropRegionIds)) {
    const cropRegion = cropRegions.find(
      (cropRegion) => cropRegion.id === questionCropRegionId
    )
    if (!cropRegion || cropRegion.type !== "QUESTION_ANSWER") continue

    const questionMaxScore = cropRegion.points || 0
    totalMaxScore += questionMaxScore

    const scoreData = examStudentScores.find(
      (questionScore) => questionScore.cropRegionId === questionCropRegionId
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
}

/**
 * 生徒の全設問合計点とその最大点を算出する（グループ定義が無い場合のフォールバック・純粋）
 */
function computeStudentTotalScore(
  examStudentId: string,
  allQuestionScores: QuestionScoreForSubtotal[],
  cropRegions: CropRegionForSubtotal[]
): SubtotalScoreResult {
  const examStudentScores = allQuestionScores.filter(
    (questionScore) => questionScore.examStudentId === examStudentId
  )

  let totalScore = 0
  let totalMaxScore = 0
  let hasScoredQuestion = false

  // 全設問領域から最大点を計算（採点データの有無に関わらず）。
  // 配点未設定は 0 点として扱う（他の小計経路と同一。以前ここだけ 10 点を既定に
  // していたため、同じ試験でも PDF と Excel で小計値が食い違っていた）
  for (const cropRegion of cropRegions) {
    if (cropRegion.type === "QUESTION_ANSWER") {
      totalMaxScore += cropRegion.points || 0
    }
  }

  // 採点データがある設問の得点を合計
  for (const scoreData of examStudentScores) {
    const cropRegion = cropRegions.find(
      (cropRegion) => cropRegion.id === scoreData.cropRegionId
    )
    if (cropRegion && cropRegion.type === "QUESTION_ANSWER") {
      const maxScore = cropRegion.points || 0
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
 * 小計点領域（SUBTOTAL_SCORE）に紐づく小計点を算出する（純粋）。
 *
 * GROUP内OR・GROUP間ANDで対象設問を絞り込む。グループ定義が無ければ全設問の合計へ
 * フォールバックする。
 *
 * @param subtotalIdsByGroupId 小計点領域に紐づく小計を SubtotalGroup ごとにまとめたもの
 * @param questionAssignments 小計 id → 割り当て設問領域 id
 */
export function computeSubtotalScoreForCropRegion(
  examStudentId: string,
  allQuestionScores: QuestionScoreForSubtotal[],
  cropRegions: CropRegionForSubtotal[],
  subtotalIdsByGroupId: Map<string, string[]>,
  questionAssignments: QuestionAssignmentsBySubtotalId
): SubtotalScoreResult {
  if (subtotalIdsByGroupId.size === 0) {
    return computeStudentTotalScore(
      examStudentId,
      allQuestionScores,
      cropRegions
    )
  }

  // 各グループで該当する設問を集める（GROUP内OR）
  const groupQuestionSets = Array.from(subtotalIdsByGroupId.values()).map(
    (subtotalIds) =>
      new Set(
        subtotalIds.flatMap(
          (subtotalId) => questionAssignments.get(subtotalId) ?? []
        )
      )
  )

  // GROUP間AND：全てのグループに共通する設問だけを残す
  const [firstGroup, ...restGroups] = groupQuestionSets
  const finalQuestionIds = Array.from(firstGroup).filter((cropRegionId) =>
    restGroups.every((group) => group.has(cropRegionId))
  )

  // 該当する設問の点数と最大点を合計（採点データがある設問のみ最大点に算入）
  const examStudentScores = allQuestionScores.filter(
    (questionScore) => questionScore.examStudentId === examStudentId
  )

  let totalScore = 0
  let totalMaxScore = 0
  let hasScoredQuestion = false

  for (const questionCropRegionId of finalQuestionIds) {
    const scoreData = examStudentScores.find(
      (questionScore) => questionScore.cropRegionId === questionCropRegionId
    )
    if (!scoreData) continue

    const cropRegion = cropRegions.find(
      (cropRegion) => cropRegion.id === questionCropRegionId
    )
    const questionMaxScore = cropRegion?.points || 0
    totalMaxScore += questionMaxScore
    const actualScore = calculateActualScore(scoreData, questionMaxScore)
    if (actualScore !== null) {
      hasScoredQuestion = true
      totalScore += actualScore
    }
  }

  return {
    score: hasScoredQuestion ? totalScore : null,
    maxScore: totalMaxScore,
    hasQuestionAssignments: true,
  }
}

/**
 * 小計点領域に紐づく小計点を計算する（DB から割り当てを引いて純粋版へ委譲）。
 */
export async function calculateSubtotalScoreForStudent(
  examStudentId: string,
  subtotalRegionId: string,
  allQuestionScores: QuestionScoreForSubtotal[],
  cropRegions: CropRegionForSubtotal[]
): Promise<SubtotalScoreResult> {
  try {
    const cropSubtotals = (await getCropSubtotalsByCropRegionId(
      subtotalRegionId
    )) as CropSubtotalWithSubtotal[]

    // グループ別に小計をまとめる
    const subtotalIdsByGroupId = new Map<string, string[]>()
    for (const cropSubtotal of cropSubtotals) {
      const groupId = cropSubtotal.subtotal?.subtotalGroupId
      if (!groupId) continue
      const subtotalIds = subtotalIdsByGroupId.get(groupId)
      if (subtotalIds) subtotalIds.push(cropSubtotal.subtotalId)
      else subtotalIdsByGroupId.set(groupId, [cropSubtotal.subtotalId])
    }

    const questionAssignments = await getQuestionAssignmentsBySubtotalIds(
      Array.from(subtotalIdsByGroupId.values()).flat()
    )

    return computeSubtotalScoreForCropRegion(
      examStudentId,
      allQuestionScores,
      cropRegions,
      subtotalIdsByGroupId,
      questionAssignments
    )
  } catch (error) {
    console.error(
      `Error calculating subtotal score for student ${examStudentId}, region ${subtotalRegionId}:`,
      error
    )
    return { score: null, maxScore: 0, hasQuestionAssignments: false }
  }
}
