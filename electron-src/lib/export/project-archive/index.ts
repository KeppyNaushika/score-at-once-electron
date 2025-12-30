/**
 * プロジェクトアーカイブ エクスポート機能
 *
 * プロジェクトの全データと画像をZIPアーカイブとしてエクスポート
 */

import { app, dialog } from "electron"
import { collectProjectData } from "./dataCollector"
import { createArchive, generateExportFileName } from "./archiveCreator"
import type {
  ExportProjectOptions,
  ExportProjectResult,
} from "../../../../types/projectArchive.types"
import { getProjectById } from "../../prisma/project"

/**
 * プロジェクトをエクスポート
 *
 * @param options - エクスポートオプション
 * @returns エクスポート結果
 */
export async function exportProject(
  options: ExportProjectOptions
): Promise<ExportProjectResult> {
  const { projectId, outputPath } = options

  try {
    // 1. プロジェクト情報を取得
    const project = await getProjectById(projectId)
    if (!project) {
      return { success: false, error: "プロジェクトが見つかりません" }
    }

    // 2. データを収集
    console.log("Collecting project data...")
    const collectResult = await collectProjectData(projectId)
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
        filters: [{ name: "Score at Once アーカイブ", extensions: ["score"] }],
      })

      if (result.canceled || !result.filePath) {
        return { success: false, error: "キャンセルされました" }
      }
      finalOutputPath = result.filePath
    }

    // 4. アーカイブを作成
    console.log("Creating archive...")
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
        version: "1.0.0",
        schemaVersion: "unknown",
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

/**
 * エクスポート保存先選択ダイアログを表示
 */
export async function selectExportSavePath(options: {
  projectName?: string
}): Promise<{
  success: boolean
  filePath?: string
  canceled?: boolean
}> {
  const defaultFileName = generateExportFileName(
    options.projectName || "project"
  )

  const result = await dialog.showSaveDialog({
    title: "プロジェクトをエクスポート",
    defaultPath: defaultFileName,
    filters: [{ name: "Score at Once アーカイブ", extensions: ["score"] }],
  })

  if (result.canceled) {
    return { success: true, canceled: true }
  }

  return { success: true, filePath: result.filePath }
}

// Re-export types
export * from "./dataCollector"
export * from "./archiveCreator"
