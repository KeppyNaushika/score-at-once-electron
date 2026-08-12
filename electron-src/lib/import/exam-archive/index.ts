/**
 * 試験アーカイブ インポート機能
 *
 * ZIPアーカイブから試験をインポート
 * v0.2.z (archive format 1.0.0) 互換対応
 */

import type {
  AnalyzeArchiveOptions,
  AnalyzeArchiveResult,
} from "../../../../src/types/examArchive.types"
import { readManifestOnly } from "./archiveExtractor"
import { validateManifest } from "./manifestValidator"

/**
 * アーカイブを解析（プレビュー用）
 *
 * ZIPを完全に展開せずにマニフェストのみを読み込む。読めなければ例外。
 *
 * @param options - 解析オプション
 * @returns マニフェストと互換性情報
 */
export async function analyzeArchive(
  options: AnalyzeArchiveOptions
): Promise<AnalyzeArchiveResult> {
  const readResult = await readManifestOnly(options.archivePath)
  if (!readResult.success || !readResult.manifest) {
    throw new Error(readResult.error ?? "アーカイブの解析に失敗しました")
  }

  const validationResult = validateManifest(readResult.manifest)

  return {
    manifest: validationResult.manifest,
    compatibility: validationResult.compatibility,
  }
}
