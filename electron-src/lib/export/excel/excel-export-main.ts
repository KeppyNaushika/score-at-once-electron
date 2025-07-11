import * as ExcelJS from "exceljs"
import {
  ExportGradingDataOptions,
  ExportResult,
} from "../../shared/types/export-types"
import { fetchExportData } from "./data-fetcher"
import { saveWorkbook } from "./file-saver"
import { createResultSheet, createScoreSheet } from "./sheet-creators"

/**
 * Excel出力のメイン処理
 *
 * @param options - 出力オプション（プロジェクトID、選択生徒ID配列、出力パス）
 * @returns 出力結果（成功/失敗、出力パス、エラーメッセージ）
 */
export async function exportGradingDataExcel(
  options: ExportGradingDataOptions,
): Promise<ExportResult> {
  try {
    const { projectId, selectedStudentIds } = options

    // データの取得
    const dataResult = await fetchExportData(projectId, selectedStudentIds)
    if (!dataResult.success) {
      return { success: false, error: dataResult.error }
    }

    const {
      project,
      selectedStudents,
      questionRegions,
      subtotalRegions,
      scoringData,
    } = dataResult

    // Excelワークブック作成
    const workbook = new ExcelJS.Workbook()

    // データが正常に取得できているかチェック
    if (
      !dataResult.questionRegions ||
      !dataResult.subtotalRegions ||
      !dataResult.scoringData
    ) {
      return { success: false, error: "必要なデータの取得に失敗しました" }
    }

    // 点数一覧シート作成
    const scoreSheet = await createScoreSheet(
      workbook,
      project,
      dataResult.questionRegions,
      dataResult.subtotalRegions,
      dataResult.scoringData,
    )

    // 正誤一覧シート作成
    const resultSheet = await createResultSheet(
      workbook,
      project,
      dataResult.questionRegions,
      dataResult.subtotalRegions,
      dataResult.scoringData,
    )

    // ファイル保存
    const saveResult = await saveWorkbook(workbook, options.outputPath)
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
