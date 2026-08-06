/**
 * 小計点の算出。
 *
 * 純粋関数（compute*）と、DB から割り当てを引いてから委譲する薄いラッパ（calculate*）に
 * 分かれる。純粋側は prisma に触れないので renderer からも呼べる。
 */

import type { QuestionScore } from "@prisma/client"

import { getCropSubtotalsForScoring } from "../../prisma/cropSubtotal"
import { calculateActualScore } from "./actualScore"
import { selectExamCropRegions } from "./subtotalAssignments"

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
interface CropRegionForSubtotal {
  id: string
  type: string
  points: number | null
}

/**
 * 小計への設問割り当て1件。Prisma の CropSubtotal 行
 * （`subtotalWithQuestionAssignmentsInclude` 同梱）をそのまま渡せる。
 *
 * 割り当て先の設問領域を実体で持つので、配点も所属試験もこの行から読める。
 * SubtotalGroup は複数の試験で共有されうるため、当該試験の分へ絞るのは算出側の責務。
 */
export interface QuestionAssignmentForSubtotal {
  cropRegion: {
    id: string
    type: string
    points: number | null
    examPage: { examId: string }
  }
}

/** 小計点領域（SUBTOTAL_SCORE）に紐づく小計1件。グループ判定と割り当てを併せ持つ */
interface SubtotalForCropRegionScore {
  subtotalGroupId: string
  cropSubtotals: QuestionAssignmentForSubtotal[]
}

interface SubtotalScoreResult {
  score: number | null
  maxScore: number
  /** QUESTION_ASSIGNMENTが存在するか */
  hasQuestionAssignments: boolean
}

/**
 * 小計点を算出する（純粋）。
 *
 * @param examId 対象の試験。割り当てには他試験の設問も混ざるのでこれで絞る
 * @param questionAssignments その小計に割り当てられた設問（他試験の分を含む）
 */
export function computeSubtotalScore(
  examStudentId: string,
  examId: string,
  allQuestionScores: QuestionScoreForSubtotal[],
  questionAssignments: QuestionAssignmentForSubtotal[]
): SubtotalScoreResult {
  const examStudentScores = allQuestionScores.filter(
    (questionScore) => questionScore.examStudentId === examStudentId
  )

  const assignedCropRegions = selectExamCropRegions(examId, questionAssignments)
  if (assignedCropRegions.length === 0) {
    return { score: null, maxScore: 0, hasQuestionAssignments: false }
  }

  // 該当する設問の点数と最大点を合計
  let totalScore = 0
  let totalMaxScore = 0
  let hasScoredQuestion = false

  for (const cropRegion of assignedCropRegions) {
    if (cropRegion.type !== "QUESTION_ANSWER") continue

    const questionMaxScore = cropRegion.points || 0
    totalMaxScore += questionMaxScore

    const scoreData = examStudentScores.find(
      (questionScore) => questionScore.cropRegionId === cropRegion.id
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
 * @param cropRegions フォールバック（全設問合計）で読む、その試験の設問領域
 * @param assignedSubtotals 小計点領域に紐づく小計（所属グループと割り当てを併せ持つ）
 */
function computeSubtotalScoreForCropRegion(
  examStudentId: string,
  examId: string,
  allQuestionScores: QuestionScoreForSubtotal[],
  cropRegions: CropRegionForSubtotal[],
  assignedSubtotals: SubtotalForCropRegionScore[]
): SubtotalScoreResult {
  if (assignedSubtotals.length === 0) {
    return computeStudentTotalScore(
      examStudentId,
      allQuestionScores,
      cropRegions
    )
  }

  // 各グループで該当する設問を集める（GROUP内OR）
  const subtotalGroupIds = [
    ...new Set(
      assignedSubtotals.map(
        (assignedSubtotal) => assignedSubtotal.subtotalGroupId
      )
    ),
  ]
  const cropRegionsByGroup = subtotalGroupIds.map((subtotalGroupId) =>
    selectExamCropRegions(
      examId,
      assignedSubtotals
        .filter(
          (assignedSubtotal) =>
            assignedSubtotal.subtotalGroupId === subtotalGroupId
        )
        .flatMap((assignedSubtotal) => assignedSubtotal.cropSubtotals)
    )
  )

  // GROUP間AND：全てのグループに共通する設問だけを残す
  const [firstGroupCropRegions, ...restGroupCropRegions] = cropRegionsByGroup
  const finalCropRegions = firstGroupCropRegions.filter((cropRegion) =>
    restGroupCropRegions.every((groupCropRegions) =>
      groupCropRegions.some(
        (groupCropRegion) => groupCropRegion.id === cropRegion.id
      )
    )
  )

  // 該当する設問の点数と最大点を合計（採点データがある設問のみ最大点に算入）
  const examStudentScores = allQuestionScores.filter(
    (questionScore) => questionScore.examStudentId === examStudentId
  )

  let totalScore = 0
  let totalMaxScore = 0
  let hasScoredQuestion = false

  for (const cropRegion of finalCropRegions) {
    const scoreData = examStudentScores.find(
      (questionScore) => questionScore.cropRegionId === cropRegion.id
    )
    if (!scoreData) continue

    const questionMaxScore = cropRegion.points || 0
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
  examId: string,
  subtotalRegionId: string,
  allQuestionScores: QuestionScoreForSubtotal[],
  cropRegions: CropRegionForSubtotal[]
): Promise<SubtotalScoreResult> {
  try {
    const cropSubtotals = await getCropSubtotalsForScoring(subtotalRegionId)

    return computeSubtotalScoreForCropRegion(
      examStudentId,
      examId,
      allQuestionScores,
      cropRegions,
      cropSubtotals.map((cropSubtotal) => cropSubtotal.subtotal)
    )
  } catch (error) {
    console.error(
      `Error calculating subtotal score for student ${examStudentId}, region ${subtotalRegionId}:`,
      error
    )
    return { score: null, maxScore: 0, hasQuestionAssignments: false }
  }
}
