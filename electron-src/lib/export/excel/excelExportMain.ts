import * as ExcelJS from "exceljs"

import { getClassroomMembersForExam } from "../../prisma/examClassroom"
import type {
  ExportGradingDataOptions,
  FileExportResult,
} from "../../shared/types"
import { fetchExportData } from "./dataFetcher"
import { saveWorkbook } from "./fileSaver"
import { createFrequencyDistributionSheet } from "./frequencyDistributionSheetCreator"
import { createItemAnalysisSheet } from "./itemAnalysisSheetCreator"
import { createResultSheet, createScoreSheet } from "./sheetCreators"
import { createSpTableSheet } from "./spTableSheetCreator"

/**
 * Excel出力のメイン処理
 *
 * 採点データの検証（未採点・部分点漏れ・採点者間の食い違い）は renderer の出力前検証
 * （`export:validateScoringData`）が裁定サマリ込みで担う。ここへ来た時点で出力は確定なので、
 * 保存ダイアログのキャンセル以外は例外になる。
 *
 * @param options - 出力オプション（試験ID、選択生徒ID配列、出力パス）
 * @returns 保存先。キャンセルされたときは `{ canceled: true }`
 */
export async function exportGradingDataExcel(
  options: ExportGradingDataOptions
): Promise<FileExportResult> {
  const { examId, selectedExamStudentIds } = options

  // 学級平均行の母集団は「試験全体」（生徒選択に無関係）なので、全受験生徒データを
  // 1回だけ取得し、選択生徒分は in-memory で絞る（部分出力時の二重フェッチを回避）。
  // 採番学級は renderer が解決して渡す studentPlacements を使う。
  const exportData = await fetchExportData(
    examId,
    [],
    options.studentPlacements
  )

  const allScoringData = exportData.scoringData
  const selectedSet = new Set(selectedExamStudentIds)
  const scoringData =
    selectedExamStudentIds.length === 0
      ? allScoringData
      : allScoringData.filter((studentScoringData) =>
          selectedSet.has(studentScoringData.examStudentId)
        )
  if (scoringData.length === 0) {
    throw new Error("選択された生徒が見つかりません")
  }

  // teacherStatistics=true の登録学級（受験日所属生徒つき）= 学級平均行の対象
  const teacherStatisticsClassrooms = (
    await getClassroomMembersForExam(examId)
  ).filter((examClassroom) => examClassroom.teacherStatistics)

  // Excelワークブック作成
  const workbook = new ExcelJS.Workbook()

  // 点数一覧シート作成（全体平均・学級平均行つき）
  await createScoreSheet(
    workbook,
    exportData.questionRegions,
    exportData.subtotalColumns,
    scoringData,
    allScoringData,
    teacherStatisticsClassrooms
  )

  // 正誤一覧シート作成
  await createResultSheet(
    workbook,
    exportData.questionRegions,
    exportData.subtotalColumns,
    scoringData
  )

  // 問題分析シート作成
  await createItemAnalysisSheet(
    workbook,
    exportData.questionRegions,
    scoringData
  )

  // S-P表シート作成（#838）
  await createSpTableSheet(workbook, scoringData)

  // 得点度数分布シート作成（#838）
  await createFrequencyDistributionSheet(workbook, scoringData)

  // ファイル保存
  return await saveWorkbook(
    workbook,
    options.outputPath,
    exportData.exam.examName
  )
}
