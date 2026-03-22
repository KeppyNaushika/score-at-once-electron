/**
 * 試験アーカイブ エクスポート機能
 *
 * 試験の全データと画像をZIPアーカイブとしてエクスポート
 */

import { app, dialog } from "electron"

import type {
  ExportExamOptions,
  ExportExamResult,
} from "../../../../src/types/examArchive.types"
import { getExamById } from "../../prisma/exam"
import { createArchive, generateExportFileName } from "./archiveCreator"
import { collectExamData } from "./dataCollector"

/**
 * 試験をエクスポート
 *
 * @param options - エクスポートオプション
 * @returns エクスポート結果
 */
export async function exportExam(
  options: ExportExamOptions
): Promise<ExportExamResult> {
  const { examId, userId, outputPath, exportMode = "full" } = options

  try {
    // 1. 試験情報を取得
    const exam = await getExamById(examId)
    if (!exam) {
      return { success: false, error: "試験が見つかりません" }
    }

    // 2. データを収集（ログインユーザーのデータのみ、モードに応じて部分収集）
    const collectResult = await collectExamData(examId, userId, exportMode)
    if (!collectResult.success || !collectResult.data) {
      return { success: false, error: collectResult.error }
    }

    // 3. 出力先を決定
    let finalOutputPath = outputPath
    if (!finalOutputPath) {
      const defaultFileName = generateExportFileName(exam.examName, exportMode)
      const result = await dialog.showSaveDialog({
        title: "試験をエクスポート",
        defaultPath: defaultFileName,
        filters: [{ name: "一括採点試験データ", extensions: ["score"] }],
      })

      if (result.canceled || !result.filePath) {
        return { success: false, error: "キャンセルされました" }
      }
      finalOutputPath = result.filePath
    }

    // 4. アーカイブを作成
    const archiveResult = await createArchive({
      collectedData: collectResult.data,
      examName: exam.examName,
      examId,
      outputPath: finalOutputPath,
      exportMode,
    })

    if (!archiveResult.success) {
      return { success: false, error: archiveResult.error }
    }

    // 5. マニフェストを返す
    return {
      success: true,
      outputPath: archiveResult.outputPath,
      manifest: {
        version: "1.1.0", // v0.3.z format
        schemaVersion: "v0.3.0",
        appVersion: app.getVersion(),
        exportedAt: new Date().toISOString(),
        examId,
        examName: exam.examName,
        counts: collectResult.data.counts,
      },
    }
  } catch (error) {
    console.error("Error exporting exam:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "エクスポートに失敗しました",
    }
  }
}

// Re-export types
export * from "./archiveCreator"
export * from "./dataCollector"
