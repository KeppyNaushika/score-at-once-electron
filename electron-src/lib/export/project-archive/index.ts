/**
 * プロジェクトアーカイブ エクスポート機能
 *
 * プロジェクトの全データと画像をZIPアーカイブとしてエクスポート
 */

import { app, dialog } from "electron"

import type {
  ExportProjectOptions,
  ExportProjectResult,
} from "../../../../types/projectArchive.types"
import { getProjectById } from "../../prisma/project"
import { createArchive, generateExportFileName } from "./archiveCreator"
import { collectProjectData } from "./dataCollector"

/**
 * プロジェクトをエクスポート
 *
 * @param options - エクスポートオプション
 * @returns エクスポート結果
 */
export async function exportProject(
  options: ExportProjectOptions
): Promise<ExportProjectResult> {
  const { projectId, userId, outputPath } = options

  try {
    // 1. プロジェクト情報を取得
    const project = await getProjectById(projectId)
    if (!project) {
      return { success: false, error: "プロジェクトが見つかりません" }
    }

    // 2. データを収集（ログインユーザーのデータのみ）
    const collectResult = await collectProjectData(projectId, userId)
    if (!collectResult.success || !collectResult.data) {
      return { success: false, error: collectResult.error }
    }

    // 3. 出力先を決定
    let finalOutputPath = outputPath
    if (!finalOutputPath) {
      const defaultFileName = generateExportFileName(project.examName)
      const result = await dialog.showSaveDialog({
        title: "プロジェクトをエクスポート",
        defaultPath: defaultFileName,
        filters: [
          { name: "一括採点プロジェクトデータ", extensions: ["score"] },
        ],
      })

      if (result.canceled || !result.filePath) {
        return { success: false, error: "キャンセルされました" }
      }
      finalOutputPath = result.filePath
    }

    // 4. アーカイブを作成
    const archiveResult = await createArchive({
      collectedData: collectResult.data,
      projectName: project.examName,
      projectId,
      outputPath: finalOutputPath,
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
        projectId,
        projectName: project.examName,
        counts: collectResult.data.counts,
      },
    }
  } catch (error) {
    console.error("Error exporting project:", error)
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
