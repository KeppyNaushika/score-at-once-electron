/**
 * 個人成績表用データ取得・統合ロジック
 */

import type { CropRegion } from "@prisma/client"

import prisma from "../../prisma/client"
import { getCropRegionsByExamId } from "../../prisma/cropRegion"
import { getQuestionAssignmentsBySubtotalIds } from "../../prisma/cropSubtotal"
import { getClassroomMembersForExam } from "../../prisma/examClassroom"
import { getQuestionScoresForExam } from "../../prisma/questionScore"
import { getScoreDecisionsForExam } from "../../prisma/scoreDecision"
import { getActiveSubtotalGroupsForExam } from "../../prisma/subtotalGroup"
import {
  EffectiveScore,
  resolveEffectiveScores,
} from "../../shared/calculations/scoreResolution"
import {
  computeSubtotalScore,
  type QuestionAssignmentsBySubtotalId,
  type QuestionScoreForSubtotal,
} from "../../shared/calculations/subtotalCalculator"
import type { SubtotalGroupData, SubtotalScore } from "../../shared/types"
import { fetchExportData } from "../excel/dataFetcher"
import { generateLearningAdvice } from "./adviceGenerator"
import {
  calculateQuestionCorrectRates,
  calculateQuestionScoreRates,
  collectRawTotalScores,
  collectReportSubtotals,
  collectSubtotalRawScores,
} from "./statisticsCalculator"
import type {
  ExamInfoForReport,
  GetIndividualReportDataOptions,
  GetIndividualReportDataResult,
  IndividualReportData,
  ReportClassroom,
  ReportPopulation,
  StudentInfoForReport,
  SubtotalGroupInfo,
  SubtotalGroupsForReportResult,
} from "./types"

/**
 * 個人成績表用データを取得
 * SubtotalGroup単位で小計点を計算（CropRegionに依存しない）
 */
export async function fetchIndividualReportData(
  options: GetIndividualReportDataOptions
): Promise<GetIndividualReportDataResult> {
  const {
    examId,
    selectedExamStudentIds,
    options: reportOptions,
    studentPlacements,
  } = options

  try {
    // 全生徒のデータを取得（平均計算等に必要）。採番学級は renderer が解決して渡す。
    const allDataResult = await fetchExportData(examId, [], studentPlacements)
    if (!allDataResult.success || !allDataResult.exam) {
      return {
        success: false,
        error: allDataResult.error || "試験データの取得に失敗しました",
      }
    }

    // 選択された生徒のデータを取得
    const selectedDataResult = await fetchExportData(
      examId,
      selectedExamStudentIds,
      studentPlacements
    )
    if (!selectedDataResult.success || !selectedDataResult.scoringData) {
      return {
        success: false,
        error: selectedDataResult.error || "生徒データの取得に失敗しました",
      }
    }

    const exam = allDataResult.exam
    const allScoringDataFromExcel = allDataResult.scoringData || []
    const selectedScoringDataFromExcel = selectedDataResult.scoringData || []

    // 試験に紐づくタグを取得
    const examTags = await prisma.examTag.findMany({
      where: { examId },
      select: { tag: { select: { name: true } } },
    })

    // 試験情報
    const examInfo: ExamInfoForReport = {
      examName: exam.examName,
      examDate: exam.examDate,
      tags: examTags.map((examTag) => examTag.tag.name),
    }

    // 試験のactiveなSubtotalGroupsとSubtotalsを取得
    const subtotalGroupsData = await getSubtotalGroupsWithSubtotals(examId)

    // CropRegionsと採点データを取得
    const cropRegions = await getCropRegionsByExamId(examId)
    const questionRegions = cropRegions.filter(
      (cropRegion) => cropRegion.type === "QUESTION_ANSWER"
    )
    const questionScoresResult = await getQuestionScoresForExam(examId)
    const decisionsResult = await getScoreDecisionsForExam(examId)
    // 受験者×設問ごとに有効スコア1件へ解決（確定 > 提案合意 > 競合）
    const { resolved: allQuestionScores } = resolveEffectiveScores(
      questionScoresResult.success ? (questionScoresResult.scores ?? []) : [],
      decisionsResult.success ? (decisionsResult.decisions ?? []) : []
    )

    // 設問割り当ては生徒に依らないので、生徒ループの外で1回だけ引く
    const questionAssignments = await getQuestionAssignmentsBySubtotalIds(
      subtotalGroupsData.flatMap((group) =>
        group.subtotals.map((subtotal) => subtotal.id)
      )
    )

    // 全生徒の小計点を計算（Subtotal単位）
    const allScoringData = allScoringDataFromExcel.map((scoringData) => ({
      ...scoringData,
      subtotalScores: buildSubtotalScoresFromGroups(
        scoringData.examStudentId,
        subtotalGroupsData,
        allQuestionScores,
        questionRegions,
        questionAssignments
      ),
    }))

    // 選択された生徒の小計点を計算
    const selectedScoringData = selectedScoringDataFromExcel.map(
      (scoringData) => ({
        ...scoringData,
        subtotalScores: buildSubtotalScoresFromGroups(
          scoringData.examStudentId,
          subtotalGroupsData,
          allQuestionScores,
          questionRegions,
          questionAssignments
        ),
      })
    )

    // 設問別正答率・得点率を計算（全生徒データを使用）
    const questionCorrectRates = calculateQuestionCorrectRates(allScoringData)
    const questionScoreRates = calculateQuestionScoreRates(allScoringData)

    // 生徒表示（studentReport）対象の登録学級と、その受験日所属生徒を取得。
    // 各生徒の学級比較は「studentReport 選択学級 ∩ 本人の所属学級」（複数学級対応）で、
    // その交差は renderer が memberStudentIds から求める。
    const reportClassrooms: ReportClassroom[] = (
      await getClassroomMembersForExam(examId)
    )
      .filter((examClassroom) => examClassroom.studentReport)
      .map((examClassroom) => ({
        classroomId: examClassroom.classroomId,
        className: examClassroom.classroom.name,
        grade:
          examClassroom.classroom.grade != null
            ? String(examClassroom.classroom.grade)
            : null,
        memberStudentIds: examClassroom.classroom.memberships.map(
          (membership) => membership.studentId
        ),
      }))

    // 統計の母集団。生徒ごとには変わらないので試験に1つだけ返す
    const population: ReportPopulation = {
      rawTotalScores: collectRawTotalScores(allScoringData),
      subtotalRawScores: collectSubtotalRawScores(allScoringData),
      subtotals: collectReportSubtotals(allScoringData),
      classrooms: reportClassrooms,
      questionCorrectRates,
      questionScoreRates,
    }

    // 各生徒のレポートデータを構築
    const reports: IndividualReportData[] = selectedScoringData.map(
      (scoringData) => {
        // 生徒情報
        const studentInfo: StudentInfoForReport = {
          id: scoringData.studentId,
          fullName: scoringData.studentName,
          studentNumber: scoringData.studentNumber,
          grade: scoringData.grade || null,
          className: scoringData.className || null,
          attendanceNumber: scoringData.attendanceNumber ?? null,
        }

        // 学習アドバイス
        const learningAdvice = generateLearningAdvice(
          scoringData.scores,
          questionCorrectRates,
          reportOptions.adviceOptions
        )

        return {
          studentInfo,
          examInfo,
          scoringData,
          learningAdvice,
        }
      }
    )

    // 警告の収集
    const warnings = collectWarnings(selectedScoringData)

    return {
      success: true,
      reports,
      examInfo,
      population,
      warnings: warnings.hasWarnings ? warnings.data : undefined,
    }
  } catch (error) {
    console.error("Error fetching individual report data:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "データ取得に失敗しました",
    }
  }
}

/**
 * SubtotalGroupとSubtotalの情報を取得
 */
async function getSubtotalGroupsWithSubtotals(
  examId: string
): Promise<SubtotalGroupData[]> {
  const result = await getActiveSubtotalGroupsForExam(examId)
  if (!result.success || !result.examSubtotalGroups) {
    return []
  }

  return result.examSubtotalGroups.map((examSubtotalGroup) => ({
    groupId: examSubtotalGroup.subtotalGroup.id,
    groupName: examSubtotalGroup.subtotalGroup.name,
    subtotals: examSubtotalGroup.subtotalGroup.subtotals.map((subtotal) => ({
      id: subtotal.id,
      name: subtotal.name,
      order: subtotal.order,
    })),
  }))
}

/**
 * SubtotalGroup単位で小計点を計算
 * CropRegion（SUBTOTAL_SCORE）を使わず、Subtotalから直接計算
 */
function buildSubtotalScoresFromGroups(
  examStudentId: string,
  subtotalGroups: SubtotalGroupData[],
  allQuestionScores: EffectiveScore[],
  questionRegions: CropRegion[],
  questionAssignments: QuestionAssignmentsBySubtotalId
): SubtotalScore[] {
  // 採点データを変換
  const questionScoreData: QuestionScoreForSubtotal[] = allQuestionScores.map(
    (score) => ({
      examStudentId: score.examStudentId,
      cropRegionId: score.cropRegionId,
      status: score.status,
      partialScore: score.partialScore,
    })
  )

  const results: SubtotalScore[] = []

  for (const group of subtotalGroups) {
    for (const subtotal of group.subtotals) {
      const scoreResult = computeSubtotalScore(
        examStudentId,
        questionScoreData,
        questionRegions,
        questionAssignments.get(subtotal.id) ?? []
      )

      results.push({
        subtotalId: subtotal.id,
        subtotalGroupId: group.groupId,
        subtotalGroupName: group.groupName,
        subtotalLabel: subtotal.name,
        score: scoreResult.score,
        maxScore: scoreResult.maxScore,
        hasQuestionAssignments: scoreResult.hasQuestionAssignments,
      })
    }
  }

  return results
}

/**
 * 警告情報を収集
 */
function collectWarnings(
  scoringData: {
    studentId: string
    studentName: string
    scores: { status: string }[]
  }[]
): {
  hasWarnings: boolean
  data: { noScoringData: string[]; ungraded: string[] }
} {
  const noScoringData: string[] = []
  const ungraded: string[] = []

  for (const scoringDatum of scoringData) {
    const hasScores = scoringDatum.scores.length > 0
    if (!hasScores) {
      noScoringData.push(scoringDatum.studentName)
      continue
    }

    const hasUngradedScores = scoringDatum.scores.some(
      (score) => score.status === "unscored"
    )
    if (hasUngradedScores) {
      ungraded.push(scoringDatum.studentName)
    }
  }

  return {
    hasWarnings: noScoringData.length > 0 || ungraded.length > 0,
    data: { noScoringData, ungraded },
  }
}

/**
 * 試験の小計点グループ一覧を取得（個人成績表用）
 * CropRegionに依存せず、Subtotal単位で管理
 */
export async function fetchSubtotalGroupsForReport(
  examId: string
): Promise<SubtotalGroupsForReportResult> {
  try {
    const activeGroupsResult = await getActiveSubtotalGroupsForExam(examId)
    if (!activeGroupsResult.success || !activeGroupsResult.examSubtotalGroups) {
      return {
        success: false,
        error: "小計点グループの取得に失敗しました",
      }
    }

    const subtotalGroups: SubtotalGroupInfo[] =
      activeGroupsResult.examSubtotalGroups.map((examSubtotalGroup) => ({
        id: examSubtotalGroup.subtotalGroup.id,
        name: examSubtotalGroup.subtotalGroup.name,
      }))

    return {
      success: true,
      subtotalGroups,
    }
  } catch (error) {
    console.error("Error fetching subtotal groups for report:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
