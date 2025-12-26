/**
 * 個人成績表用データ取得・統合ロジック
 */

import { fetchExportData } from "../excel/data-fetcher"
import { generateLearningAdvice } from "./advice-generator"
import {
  calculateQuestionCorrectRates,
  calculateStatisticsForStudent,
} from "./statistics-calculator"
import type {
  ExamInfoForReport,
  GetIndividualReportDataOptions,
  GetIndividualReportDataResult,
  IndividualReportData,
  StudentInfoForReport,
} from "./types"

/**
 * 個人成績表用データを取得
 */
export async function fetchIndividualReportData(
  options: GetIndividualReportDataOptions,
): Promise<GetIndividualReportDataResult> {
  const { projectId, selectedStudentIds, options: reportOptions } = options

  try {
    // 全生徒のデータを取得（平均計算等に必要）
    const allDataResult = await fetchExportData(projectId, [])
    if (!allDataResult.success || !allDataResult.project) {
      return {
        success: false,
        error: allDataResult.error || "プロジェクトデータの取得に失敗しました",
      }
    }

    // 選択された生徒のデータを取得
    const selectedDataResult = await fetchExportData(projectId, selectedStudentIds)
    if (!selectedDataResult.success || !selectedDataResult.scoringData) {
      return {
        success: false,
        error: selectedDataResult.error || "生徒データの取得に失敗しました",
      }
    }

    const project = allDataResult.project
    const allScoringData = allDataResult.scoringData || []
    const selectedScoringData = selectedDataResult.scoringData || []

    // 試験情報
    const examInfo: ExamInfoForReport = {
      examName: project.examName,
      examDate: project.examDate,
      subject: project.subject,
    }

    // 設問別正答率を計算（全生徒データを使用）
    const questionCorrectRates = calculateQuestionCorrectRates(allScoringData)

    // 各生徒のレポートデータを構築
    const reports: IndividualReportData[] = selectedScoringData.map((scoringData) => {
      // 生徒情報
      const studentInfo: StudentInfoForReport = {
        id: scoringData.studentId,
        fullName: scoringData.studentName,
        studentNumber: scoringData.studentNumber,
        grade: scoringData.grade || null,
        className: scoringData.className || null,
        attendanceNumber: scoringData.attendanceNumber ?? null,
      }

      // 学級データを抽出（同じ学級の生徒のスコア）
      const classScoringData = allScoringData.filter(
        (d) => d.className === scoringData.className && d.grade === scoringData.grade,
      )

      // 統計データ
      const statistics = calculateStatisticsForStudent(
        scoringData.studentId,
        scoringData.totalScore,
        allScoringData,
        classScoringData,
        questionCorrectRates,
      )

      // 学習アドバイス
      const learningAdvice = generateLearningAdvice(
        scoringData.scores,
        questionCorrectRates,
        reportOptions.adviceOptions,
      )

      return {
        studentInfo,
        examInfo,
        scoringData,
        statistics,
        learningAdvice,
      }
    })

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
      error: error instanceof Error ? error.message : "データ取得に失敗しました",
    }
  }
}

/**
 * 警告情報を収集
 */
function collectWarnings(
  scoringData: { studentId: string; studentName: string; scores: { status: string }[] }[],
): { hasWarnings: boolean; data: { noScoringData: string[]; ungraded: string[] } } {
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
