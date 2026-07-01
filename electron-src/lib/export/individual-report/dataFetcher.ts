/**
 * 個人成績表用データ取得・統合ロジック
 */

import type { CropRegion } from "@prisma/client"

import prisma from "../../prisma/client"
import { getCropRegionsByExamId } from "../../prisma/cropRegion"
import { getClassMembersForExam } from "../../prisma/examClass"
import { getQuestionScoresForExam } from "../../prisma/questionScore"
import { getScoreDecisionsForExam } from "../../prisma/scoreDecision"
import { getActiveSubtotalGroupsForExam } from "../../prisma/subtotalGroup"
import {
  EffectiveScore,
  resolveEffectiveScores,
} from "../../shared/calculations/scoreResolution"
import {
  calculateSubtotalScoreBySubtotalId,
  type QuestionScoreData,
} from "../../shared/calculations/subtotalCalculator"
import type { SubtotalScore } from "../../shared/types/exportTypes"
import { fetchExportData } from "../excel/dataFetcher"
import { generateLearningAdvice } from "./adviceGenerator"
import {
  buildScoreByStudentId,
  calculateQuestionCorrectRates,
  calculateQuestionScoreRates,
  calculateStatisticsForStudent,
  type StudentClassForStats,
} from "./statisticsCalculator"
import type {
  ExamInfoForReport,
  GetIndividualReportDataOptions,
  GetIndividualReportDataResult,
  IndividualReportData,
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
  const { examId, selectedStudentIds, options: reportOptions } = options

  try {
    // 全生徒のデータを取得（平均計算等に必要）
    const allDataResult = await fetchExportData(examId, [])
    if (!allDataResult.success || !allDataResult.exam) {
      return {
        success: false,
        error: allDataResult.error || "試験データの取得に失敗しました",
      }
    }

    // 選択された生徒のデータを取得
    const selectedDataResult = await fetchExportData(examId, selectedStudentIds)
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
      tags: examTags.map((et) => et.tag.name),
    }

    // 試験のactiveなSubtotalGroupsとSubtotalsを取得
    const subtotalGroupsData = await getSubtotalGroupsWithSubtotals(examId)

    // CropRegionsと採点データを取得
    const cropRegions = await getCropRegionsByExamId(examId)
    const questionRegions = cropRegions.filter(
      (r) => r.type === "QUESTION_ANSWER"
    )
    const questionScoresResult = await getQuestionScoresForExam(examId)
    const decisionsResult = await getScoreDecisionsForExam(examId)
    // 生徒×設問ごとに有効スコア1件へ解決（確定 > 提案合意 > 競合）
    const { resolved: allQuestionScores } = resolveEffectiveScores(
      questionScoresResult.success ? (questionScoresResult.scores ?? []) : [],
      decisionsResult.success ? (decisionsResult.decisions ?? []) : []
    )

    // 全生徒の小計点を計算（Subtotal単位）
    const allScoringData = await Promise.all(
      allScoringDataFromExcel.map(async (data) => {
        const subtotalScores = await buildSubtotalScoresFromGroups(
          data.studentId,
          subtotalGroupsData,
          allQuestionScores,
          questionRegions
        )
        return { ...data, subtotalScores }
      })
    )

    // 選択された生徒の小計点を計算
    const selectedScoringData = await Promise.all(
      selectedScoringDataFromExcel.map(async (data) => {
        const subtotalScores = await buildSubtotalScoresFromGroups(
          data.studentId,
          subtotalGroupsData,
          allQuestionScores,
          questionRegions
        )
        return { ...data, subtotalScores }
      })
    )

    // 設問別正答率・得点率を計算（全生徒データを使用）
    const questionCorrectRates = calculateQuestionCorrectRates(allScoringData)
    const questionScoreRates = calculateQuestionScoreRates(allScoringData)

    // 生徒表示（studentReport）対象の登録学級と、その受験日所属生徒を取得。
    // 各生徒の学級比較は「studentReport 選択学級 ∩ 本人の所属学級」（複数学級対応）。
    const studentReportClasses = (await getClassMembersForExam(examId)).filter(
      (c) => c.studentReport
    )

    // studentId → 本人が所属する studentReport 学級（複数学級対応）。学級ごとに
    // 1回だけ変換し、生徒ごとの走査（O(学級×学級人数)）を避ける。
    const studentClassesByStudentId = new Map<string, StudentClassForStats[]>()
    for (const c of studentReportClasses) {
      const memberStudentIds = c.classroom.memberships.map((m) => m.studentId)
      const entry: StudentClassForStats = {
        classroomId: c.classroomId,
        className: c.classroom.name,
        grade: c.classroom.grade != null ? String(c.classroom.grade) : null,
        memberStudentIds,
      }
      for (const sid of memberStudentIds) {
        const list = studentClassesByStudentId.get(sid)
        if (list) list.push(entry)
        else studentClassesByStudentId.set(sid, [entry])
      }
    }

    // 全生徒の合計点索引を1回だけ構築し、各生徒の統計算出で共有（再構築の O(N^2) 回避）
    const scoreByStudentId = buildScoreByStudentId(allScoringData)

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

        // 本人が所属する studentReport 学級（事前構築した Map から O(1) 取得）
        const studentClasses =
          studentClassesByStudentId.get(scoringData.studentId) ?? []

        // 統計データ（subtotalScoresから直接グループ情報を取得可能）
        const statistics = calculateStatisticsForStudent(
          scoringData.studentId,
          scoringData.totalScore,
          allScoringData,
          studentClasses,
          questionCorrectRates,
          questionScoreRates,
          scoreByStudentId
        )

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
          statistics,
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
interface SubtotalGroupData {
  groupId: string
  groupName: string
  subtotals: Array<{
    id: string
    name: string
    order: number
  }>
}

async function getSubtotalGroupsWithSubtotals(
  examId: string
): Promise<SubtotalGroupData[]> {
  const result = await getActiveSubtotalGroupsForExam(examId)
  if (!result.success || !result.examSubtotalGroups) {
    return []
  }

  return result.examSubtotalGroups.map((psg) => ({
    groupId: psg.subtotalGroup.id,
    groupName: psg.subtotalGroup.name,
    subtotals: psg.subtotalGroup.subtotals.map((s) => ({
      id: s.id,
      name: s.name,
      order: s.order,
    })),
  }))
}

/**
 * SubtotalGroup単位で小計点を計算
 * CropRegion（SUBTOTAL_SCORE）を使わず、Subtotalから直接計算
 */
async function buildSubtotalScoresFromGroups(
  studentId: string,
  subtotalGroups: SubtotalGroupData[],
  allQuestionScores: EffectiveScore[],
  questionRegions: CropRegion[]
): Promise<SubtotalScore[]> {
  // 採点データを変換
  const questionScoreData: QuestionScoreData[] = allQuestionScores.map(
    (score) => ({
      studentId: score.studentId,
      cropRegionId: score.cropRegionId,
      status: score.status,
      partialScore: score.partialScore,
    })
  )

  const results: SubtotalScore[] = []

  for (const group of subtotalGroups) {
    for (const subtotal of group.subtotals) {
      const scoreResult = await calculateSubtotalScoreBySubtotalId(
        studentId,
        subtotal.id,
        questionScoreData,
        questionRegions
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

  for (const data of scoringData) {
    const hasScores = data.scores.length > 0
    if (!hasScores) {
      noScoringData.push(data.studentName)
      continue
    }

    const hasUngradedScores = data.scores.some((s) => s.status === "unscored")
    if (hasUngradedScores) {
      ungraded.push(data.studentName)
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
      activeGroupsResult.examSubtotalGroups.map((psg) => ({
        id: psg.subtotalGroup.id,
        name: psg.subtotalGroup.name,
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
