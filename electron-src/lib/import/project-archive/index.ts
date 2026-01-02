/**
 * プロジェクトアーカイブ インポート機能
 *
 * ZIPアーカイブからプロジェクトをインポート
 * v0.2.z (archive format 1.0.0) 互換対応
 */

import type {
  AnalyzeArchiveOptions,
  AnalyzeArchiveResult,
  ImportAsNewOptions,
  ImportAsNewResult,
} from "../../../../types/projectArchive.types"
import {
  requiresTransformation,
  transformArchiveData,
} from "../versionedImporter"
import {
  cleanupTempDir,
  extractArchive,
  readManifestOnly,
} from "./archiveExtractor"
import { createImportedData } from "./dataCreator"
import { generateNewIdMappings } from "./idRemapper"
import { validateManifest } from "./manifestValidator"

/**
 * アーカイブを解析（プレビュー用）
 *
 * ZIPを完全に展開せずにマニフェストのみを読み込む
 *
 * @param options - 解析オプション
 * @returns 解析結果
 */
export async function analyzeArchive(
  options: AnalyzeArchiveOptions
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
 * v0.3.0以降: userIdは現在ログインしているユーザーで上書き
 *
 * @param options - インポートオプション
 * @returns インポート結果
 */
export async function importAsNew(
  options: ImportAsNewOptions
): Promise<ImportAsNewResult> {
  let tempDir: string | null = null

  try {
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

    // 3. バージョン変換を適用（必要な場合）
    let processedData = extractResult.data
    if (requiresTransformation(extractResult.data.manifest)) {
      const transformedData = transformArchiveData(extractResult.data)
      processedData = transformedData
      // 変換時の警告を追加
      warnings.push(...transformedData.transformWarnings)
    }

    // 4. 新しいIDマッピングを生成
    const mappings = generateNewIdMappings(processedData)

    // 5. データを作成（現在のログインユーザーIDを渡す）
    const createResult = await createImportedData(
      processedData,
      mappings,
      options.currentUserId
    )
    if (!createResult.success) {
      return { success: false, error: createResult.error }
    }

    // 作成時の警告を追加
    if (createResult.warnings) {
      warnings.push(...createResult.warnings)
    }

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
        error instanceof Error ? error.message : "インポートに失敗しました",
    }
  } finally {
    // 一時ディレクトリをクリーンアップ
    if (tempDir) {
      cleanupTempDir(tempDir)
    }
  }
}

// Re-export for convenience
export * from "./archiveExtractor"
export * from "./dataCreator"
export * from "./idRemapper"
export * from "./manifestValidator"
