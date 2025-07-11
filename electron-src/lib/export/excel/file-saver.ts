import { dialog } from "electron"
import * as ExcelJS from "exceljs"
import { ExportResult } from "../../shared/types/export-types"

/**
 * ワークブックを保存する
 *
 * @param workbook - 保存するワークブック
 * @param outputPath - 出力パス（省略可能）
 * @returns 保存結果
 */
export async function saveWorkbook(
  workbook: ExcelJS.Workbook,
  outputPath?: string,
): Promise<ExportResult> {
  try {
    let finalOutputPath = outputPath

    if (!finalOutputPath) {
      const result = await dialog.showSaveDialog({
        title: "Excel出力先を選択",
        defaultPath: `採点結果_${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [{ name: "Excelファイル", extensions: ["xlsx"] }],
      })

      if (result.canceled) {
        return { success: false, error: "出力がキャンセルされました" }
      }

      finalOutputPath = result.filePath
    }

    if (!finalOutputPath) {
      return { success: false, error: "出力パスが指定されていません" }
    }

    await workbook.xlsx.writeFile(finalOutputPath)
    return { success: true, outputPath: finalOutputPath }
  } catch (error) {
    console.error("Error saving workbook:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "ファイル保存に失敗しました",
    }
  }
}
