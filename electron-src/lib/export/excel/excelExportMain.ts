import * as ExcelJS from "exceljs"

import {
  ExportGradingDataOptions,
  ExportResult,
} from "../../shared/types/exportTypes"
import { validateScoringData } from "../../shared/utilities/validateScoringData"
import { fetchExportData } from "./dataFetcher"
import { saveWorkbook } from "./fileSaver"
import { createItemAnalysisSheet } from "./itemAnalysisSheetCreator"
import { createResultSheet, createScoreSheet } from "./sheetCreators"

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

    // データの取得
    const dataResult = await fetchExportData(examId, selectedStudentIds)
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

    // 採点データの検証と警告の生成（強制実行でない場合のみ）
    if (!options.forceExport) {
      const validationResult = validateScoringData(dataResult.scoringData)
      if (validationResult.hasWarnings) {
        return {
          success: false,
          error: "採点データに問題があります",
          warnings: validationResult.warnings,
          validationResult: validationResult,
        }
      }
    }

    // Excelワークブック作成
    const workbook = new ExcelJS.Workbook()

    // 点数一覧シート作成
    await createScoreSheet(
      workbook,
      dataResult.questionRegions,
      dataResult.subtotalColumns,
      dataResult.scoringData
    )

    // 正誤一覧シート作成
    await createResultSheet(
      workbook,
      dataResult.questionRegions,
      dataResult.subtotalColumns,
      dataResult.scoringData
    )

    // 問題分析シート作成
    await createItemAnalysisSheet(
      workbook,
      dataResult.questionRegions,
      dataResult.scoringData
    )

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
