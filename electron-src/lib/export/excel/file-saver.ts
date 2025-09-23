import { dialog } from "electron"
import * as ExcelJS from "exceljs"
import { ExportResult } from "../../shared/types/export-types"

/**
 * ファイル名として安全でない文字を置換する
 * @param name - 元の名前
 * @returns サニタイズされた名前
 */
function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim()
}

/**
 * ワークブックを保存する
 *
 * @param workbook - 保存するワークブック
 * @param outputPath - 出力パス（省略可能）
 * @param projectName - プロジェクト名（省略可能）
 * @returns 保存結果
 */
export async function saveWorkbook(
  workbook: ExcelJS.Workbook,
  outputPath?: string,
  projectName?: string,
): Promise<ExportResult> {
  try {
    let finalOutputPath = outputPath

    if (!finalOutputPath) {
      const dateStr = new Date().toISOString().slice(0, 10)
      const safeProjectName = projectName ? sanitizeFileName(projectName) : null
      const fileName = safeProjectName 
        ? `採点結果_${safeProjectName}_${dateStr}.xlsx`
        : `採点結果_${dateStr}.xlsx`
        
      const result = await dialog.showSaveDialog({
        title: "Excel出力先を選択",
        defaultPath: fileName,
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
