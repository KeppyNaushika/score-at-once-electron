import * as ExcelJS from "exceljs"

import { getClassMembersForExam } from "../../prisma/examClass"
import {
  ExportGradingDataOptions,
  ExportResult,
} from "../../shared/types/exportTypes"
import {
  buildConflictIdentifiers,
  validateScoringData,
} from "../../shared/utilities/validateScoringData"
import { fetchExportData } from "./dataFetcher"
import { saveWorkbook } from "./fileSaver"
import { createFrequencyDistributionSheet } from "./frequencyDistributionSheetCreator"
import { createItemAnalysisSheet } from "./itemAnalysisSheetCreator"
import { createResultSheet, createScoreSheet } from "./sheetCreators"
import { createSpTableSheet } from "./spTableSheetCreator"

/**
 * Excel出力のメイン処理
 *
 * @param options - 出力オプション（試験ID、選択生徒ID配列、出力パス）
 * @returns 出力結果（成功/失敗、出力パス、エラーメッセージ）
 */
export async function exportGradingDataExcel(
  options: ExportGradingDataOptions
): Promise<ExportResult> {
  try {
    const { examId, selectedStudentIds } = options

    // 学級平均行の母集団は「試験全体」（生徒選択に無関係）なので、全受験生徒データを
    // 1回だけ取得し、選択生徒分は in-memory で絞る（部分出力時の二重フェッチを回避）。
    const dataResult = await fetchExportData(examId, [])
    if (!dataResult.success) {
      return { success: false, error: dataResult.error }
    }

    // データが正常に取得できているかチェック
    if (
      !dataResult.questionRegions ||
      !dataResult.subtotalColumns ||
      !dataResult.scoringData
    ) {
      return { success: false, error: "必要なデータの取得に失敗しました" }
    }

    const allScoringData = dataResult.scoringData
    const selectedSet = new Set(selectedStudentIds)
    const scoringData =
      selectedStudentIds.length === 0
        ? allScoringData
        : allScoringData.filter((studentScoringData) =>
            selectedSet.has(studentScoringData.studentId)
          )
    if (scoringData.length === 0) {
      return { success: false, error: "選択された生徒が見つかりません" }
    }

    // 採点データの検証と警告の生成（強制実行でない場合のみ）
    if (!options.forceExport) {
      const validationResult = validateScoringData(
        scoringData,
        buildConflictIdentifiers(scoringData, dataResult.scoreConflicts ?? [])
      )
      if (validationResult.hasWarnings) {
        return {
          success: false,
          error: "採点データに問題があります",
          warnings: validationResult.warnings,
          validationResult: validationResult,
        }
      }
    }

    // teacherStat=true の登録学級（受験日所属生徒つき）= 学級平均行の対象
    const teacherStatClasses = (await getClassMembersForExam(examId)).filter(
      (examClass) => examClass.teacherStat
    )

    // Excelワークブック作成
    const workbook = new ExcelJS.Workbook()

    // 点数一覧シート作成（全体平均・学級平均行つき）
    await createScoreSheet(
      workbook,
      dataResult.questionRegions,
      dataResult.subtotalColumns,
      scoringData,
      allScoringData,
      teacherStatClasses
    )

    // 正誤一覧シート作成
    await createResultSheet(
      workbook,
      dataResult.questionRegions,
      dataResult.subtotalColumns,
      scoringData
    )

    // 問題分析シート作成
    await createItemAnalysisSheet(
      workbook,
      dataResult.questionRegions,
      scoringData
    )

    // S-P表シート作成（#838）
    await createSpTableSheet(workbook, scoringData)

    // 得点度数分布シート作成（#838）
    await createFrequencyDistributionSheet(workbook, scoringData)

    // ファイル保存
    const examName = dataResult.exam?.examName
    const saveResult = await saveWorkbook(
      workbook,
      options.outputPath,
      examName
    )
    if (!saveResult.success) {
      return { success: false, error: saveResult.error }
    }

    return { success: true, outputPath: saveResult.outputPath }
  } catch (error) {
    console.error("Excel export error:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "不明なエラーが発生しました",
    }
  }
}
