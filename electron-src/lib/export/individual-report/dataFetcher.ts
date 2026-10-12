/**
 * 個人成績表用データ取得・統合ロジック
 */

import type {
  ExamInfoForReport,
  GetIndividualReportDataOptions,
  GetIndividualReportDataResult,
  IndividualReportData,
  ReportClassroom,
  ReportPopulation,
  StudentInfoForReport,
  SubtotalGroupInfo,
} from "@/types/individualReport.types"

import prisma from "../../prisma/client"
import { getClassroomMembersForExam } from "../../prisma/examClassroom"
import { getActiveSubtotalGroupsForExam } from "../../prisma/subtotalGroup"
import { fetchExportData } from "../excel/dataFetcher"
import { generateLearningAdvice } from "./adviceGenerator"
import {
  calculateQuestionCorrectRates,
  calculateQuestionScoreRates,
  collectRawTotalScores,
  collectReportSubtotals,
  collectSubtotalRawScores,
} from "./statisticsCalculator"

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

  // 全生徒のデータを取得（平均計算等に必要）。採番学級は renderer が解決して渡す。
  const allExportData = await fetchExportData(examId, [], studentPlacements)

  // 選択された生徒のデータを取得
  const selectedExportData = await fetchExportData(
    examId,
    selectedExamStudentIds,
    studentPlacements
  )

  // 小計点（Subtotal単位）は fetchExportData が同じ有効スコアから算出済みなので引き直さない
  const exam = allExportData.exam
  const allScoringData = allExportData.scoringData
  const selectedScoringData = selectedExportData.scoringData

  // 試験に紐づくタグを取得
  const examTags = await prisma.examTag.findMany({
    where: { examId },
    include: { tag: true },
  })

  // 試験情報
  const examInfo: ExamInfoForReport = {
    examName: exam.examName,
    referenceDate: exam.referenceDate,
    tags: examTags.map((examTag) => examTag.tag.name),
  }

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

  return { reports, examInfo, population }
}

/**
 * 試験の小計点グループ一覧を取得（個人成績表用）
 * CropRegionに依存せず、Subtotal単位で管理
 */
export async function fetchSubtotalGroupsForReport(
  examId: string
): Promise<SubtotalGroupInfo[]> {
  const activeExamSubtotalGroups = await getActiveSubtotalGroupsForExam(examId)

  return activeExamSubtotalGroups.map((examSubtotalGroup) => ({
    id: examSubtotalGroup.subtotalGroup.id,
    name: examSubtotalGroup.subtotalGroup.name,
  }))
}
