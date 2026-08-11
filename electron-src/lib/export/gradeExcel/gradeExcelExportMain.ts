/**
 * 成績算出Excel出力メイン関数
 */

import * as ExcelJS from "exceljs"

import type { FileExportResult } from "../../shared/types"
import { saveWorkbook } from "../excel/fileSaver"
import { fetchGradeExportData } from "./gradeDataFetcher"
import { createDetailSheet, createGradeResultSheet } from "./gradeSheetCreator"

export async function exportGradeExcel(
  gradeId: string,
  options?: { outputPath?: string; studentIds?: string[] }
): Promise<FileExportResult> {
  const { result, examName } = await fetchGradeExportData(gradeId)

  // 生徒フィルタ
  const filteredResult =
    options?.studentIds && options.studentIds.length > 0
      ? {
          ...result,
          students: result.students.filter((student) =>
            options.studentIds!.includes(student.studentId)
          ),
        }
      : result

  const workbook = new ExcelJS.Workbook()

  createGradeResultSheet(workbook, filteredResult)
  createDetailSheet(workbook, filteredResult)

  return saveWorkbook(workbook, options?.outputPath, `成績_${examName}`)
}
