/**
 * 試験アーカイブ インポート機能
 *
 * ZIPアーカイブから試験をインポート
 * v0.2.z (archive format 1.0.0) 互換対応
 */

import type {
  AnalyzeArchiveOptions,
  AnalyzeArchiveResult,
} from "../../../../types/examArchive.types"
import { readManifestOnly } from "./archiveExtractor"
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

// Re-export for convenience
export * from "./archiveExtractor"
export * from "./dataCreator"
export * from "./idRemapper"
export * from "./manifestValidator"
