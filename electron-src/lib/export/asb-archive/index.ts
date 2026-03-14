/**
 * ASB定義エクスポート機能
 */

import { dialog } from "electron"

import { getAsbDefinition } from "../../prisma/asbDefinition"
import { createAsbArchive, generateAsbExportFileName } from "./archiveCreator"
import { collectAsbData } from "./dataCollector"

/**
 * 解答用紙定義をエクスポート
 */
export async function exportAsbDefinition(
  definitionId: string
): Promise<{ success: boolean; outputPath?: string; error?: string }> {
  try {
    // 1. 定義を取得
    const definition = await getAsbDefinition(definitionId)
    if (!definition) {
      return { success: false, error: "定義が見つかりません" }
    }

    // 2. データ収集
    const collected = collectAsbData(definition)

    // 3. 保存先を選択
    const defaultFileName = generateAsbExportFileName(definition.name)
    const result = await dialog.showSaveDialog({
      title: "解答用紙定義を書き出し",
      defaultPath: defaultFileName,
      filters: [{ name: "解答用紙定義", extensions: ["asb"] }],
    })

    if (result.canceled || !result.filePath) {
      return { success: false, error: "キャンセルされました" }
    }

    // 4. アーカイブを作成
    return await createAsbArchive(collected, result.filePath)
  } catch (error) {
    console.error("Error exporting ASB definition:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "書き出しに失敗しました",
    }
  }
}

export { createAsbArchive, generateAsbExportFileName } from "./archiveCreator"
export { collectAsbData } from "./dataCollector"
