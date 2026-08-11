import { dialog } from "electron"
import type * as ExcelJS from "exceljs"

import type { FileExportResult } from "../../shared/types"

/**
 * ファイル名として安全でない文字を置換する
 * @param name - 元の名前
 * @returns サニタイズされた名前
 */
function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim()
}

/**
 * ワークブックを保存する
 *
 * @param workbook - 保存するワークブック
 * @param outputPath - 出力パス（省略可能）
 * @param examName - 試験名（省略可能）
 * @returns 保存先。ダイアログがキャンセルされたときは `{ canceled: true }`
 */
export async function saveWorkbook(
  workbook: ExcelJS.Workbook,
  outputPath?: string,
  examName?: string
): Promise<FileExportResult> {
  let finalOutputPath = outputPath

  if (!finalOutputPath) {
    const dateStr = new Date().toISOString().slice(0, 10)
    const safeExamName = examName ? sanitizeFileName(examName) : null
    const fileName = safeExamName
      ? `採点結果_${safeExamName}_${dateStr}.xlsx`
      : `採点結果_${dateStr}.xlsx`

    const result = await dialog.showSaveDialog({
      title: "Excel出力先を選択",
      defaultPath: fileName,
      filters: [{ name: "Excelファイル", extensions: ["xlsx"] }],
    })

    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }

    finalOutputPath = result.filePath
  }

  await workbook.xlsx.writeFile(finalOutputPath)
  return { canceled: false, outputPath: finalOutputPath }
}
