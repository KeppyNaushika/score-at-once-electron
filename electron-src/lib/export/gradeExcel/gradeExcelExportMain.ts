/**
 * 成績算出Excel出力メイン関数
 */

import * as ExcelJS from "exceljs"

import { saveWorkbook } from "../excel/fileSaver"
import { fetchGradeExportData } from "./gradeDataFetcher"
import { createDetailSheet, createGradeResultSheet } from "./gradeSheetCreator"

export async function exportGradeExcel(
  gradeId: string,
  options?: { outputPath?: string; studentIds?: string[] }
): Promise<{ success: boolean; outputPath?: string; error?: string }> {
  try {
    const fetchResult = await fetchGradeExportData(gradeId)
    if (!fetchResult.success || !fetchResult.data) {
      return {
        success: false,
        error: fetchResult.error ?? "データ取得に失敗しました",
      }
    }

    const { result, examName } = fetchResult.data

    // 生徒フィルタ
    const filteredResult =
      options?.studentIds && options.studentIds.length > 0
        ? {
            ...result,
            students: result.students.filter((s) =>
              options.studentIds!.includes(s.studentId)
            ),
          }
        : result

    const workbook = new ExcelJS.Workbook()

    createGradeResultSheet(workbook, filteredResult)
    createDetailSheet(workbook, filteredResult)

    return saveWorkbook(workbook, options?.outputPath, `成績_${examName}`)
  } catch (error) {
    console.error("Error exporting grade Excel:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Excel出力に失敗しました",
    }
  }
}
