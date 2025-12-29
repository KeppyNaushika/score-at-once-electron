/**
 * プロジェクトアーカイブ インポート機能
 *
 * ZIPアーカイブからプロジェクトをインポート
 */

import {
  extractArchive,
  cleanupTempDir,
  readManifestOnly,
} from "./archive-extractor"
import { validateManifest } from "./manifest-validator"
import { generateNewIdMappings } from "./id-remapper"
import { createImportedData } from "./data-creator"
import type {
  ImportAsNewOptions,
  ImportAsNewResult,
  AnalyzeArchiveOptions,
  AnalyzeArchiveResult,
} from "../../../../types/project-archive.types"

/**
 * アーカイブを解析（プレビュー用）
 *
 * ZIPを完全に展開せずにマニフェストのみを読み込む
 *
 * @param options - 解析オプション
 * @returns 解析結果
 */
export async function analyzeArchive(
  options: AnalyzeArchiveOptions,
): Promise<AnalyzeArchiveResult> {
  try {
    // マニフェストのみを読み込む
    const readResult = await readManifestOnly(options.archivePath)
    if (!readResult.success || !readResult.manifest) {
      return { success: false, error: readResult.error }
    }

    // マニフェストを検証
    const validationResult = validateManifest(readResult.manifest)
    if (!validationResult.success) {
      return { success: false, error: validationResult.error }
    }

    return {
      success: true,
      manifest: validationResult.manifest,
      compatibility: validationResult.compatibility,
    }
  } catch (error) {
    console.error("Error analyzing archive:", error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "アーカイブの解析に失敗しました",
    }
  }
}

/**
 * 新規作成モードでインポート
 *
 * 全てのデータを新規UUIDで作成
 *
 * @param options - インポートオプション
 * @returns インポート結果
 */
export async function importAsNew(
  options: ImportAsNewOptions,
): Promise<ImportAsNewResult> {
  let tempDir: string | null = null

  try {
    console.log("Starting import (new mode):", options.archivePath)

    // 1. アーカイブを展開
    const extractResult = await extractArchive(options.archivePath)
    if (!extractResult.success || !extractResult.data) {
      return { success: false, error: extractResult.error }
    }
    tempDir = extractResult.data.tempDir

    // 2. マニフェストを検証
    const validationResult = validateManifest(extractResult.data.manifest)
    if (!validationResult.success) {
      return { success: false, error: validationResult.error }
    }

    // 互換性警告を収集
    const warnings: string[] = validationResult.compatibility?.warnings || []

    // 3. 新しいIDマッピングを生成
    const mappings = generateNewIdMappings(extractResult.data)

    // 4. データを作成
    const createResult = await createImportedData(extractResult.data, mappings)
    if (!createResult.success) {
      return { success: false, error: createResult.error }
    }

    // 作成時の警告を追加
    if (createResult.warnings) {
      warnings.push(...createResult.warnings)
    }

    console.log("Import completed successfully:", createResult.projectId)

    return {
      success: true,
      projectId: createResult.projectId,
      importedCounts: createResult.counts,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  } catch (error) {
    console.error("Error importing archive:", error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "インポートに失敗しました",
    }
  } finally {
    // 一時ディレクトリをクリーンアップ
    if (tempDir) {
      cleanupTempDir(tempDir)
    }
  }
}

// Re-export for convenience
export * from "./archive-extractor"
export * from "./manifest-validator"
export * from "./id-remapper"
export * from "./data-creator"
