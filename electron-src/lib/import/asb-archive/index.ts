/**
 * ASB定義インポート機能
 */

import type { AsbArchiveManifest } from "../../../../src/types/asbArchive.types"
import { transformAsbToLatest } from "../asb-transformers"
import {
  cleanupAsbTempDir,
  extractAsbArchive,
  readAsbManifestOnly,
} from "./archiveExtractor"
import {
  copyImagesAndUpdatePaths,
  createImportedAsbDefinition,
  resolveNameConflict,
} from "./dataCreator"
import { generateAsbIdMappings, remapDefinitionIds } from "./idRemapper"
import { validateAsbManifest } from "./manifestValidator"

/**
 * ASBアーカイブを分析（プレビュー用）
 */
export async function analyzeAsbArchive(filePath: string): Promise<{
  success: boolean
  manifest?: AsbArchiveManifest
  error?: string
}> {
  return readAsbManifestOnly(filePath)
}

/**
 * ASBアーカイブをインポート
 */
export async function importAsbDefinition(
  filePath: string,
  userId: string
): Promise<{
  success: boolean
  definitionId?: string
  warnings?: string[]
  error?: string
}> {
  let tempDir: string | undefined

  try {
    // 1. 展開
    const extractResult = await extractAsbArchive(filePath)
    if (!extractResult.success || !extractResult.data) {
      return { success: false, error: extractResult.error }
    }
    tempDir = extractResult.data.tempDir

    const { manifest, definition, imagePaths } = extractResult.data

    // 2. マニフェスト検証
    const validation = validateAsbManifest(manifest)
    if (!validation.valid) {
      return { success: false, error: validation.error }
    }

    // 3. バージョン変換
    const transformResult = transformAsbToLatest({ manifest, definition })
    const warnings = [...transformResult.warnings]
    const transformedDefinition = transformResult.data.definition

    // 4. IDリマッピング
    const mappings = generateAsbIdMappings(transformedDefinition)
    const remapped = remapDefinitionIds(transformedDefinition, mappings)

    // 5. 名前重複チェック
    remapped.name = await resolveNameConflict(remapped.name, userId)

    // 6. 画像コピー + パス更新
    copyImagesAndUpdatePaths(remapped, imagePaths)

    // 7. DB保存
    await createImportedAsbDefinition(remapped, userId)

    return {
      success: true,
      definitionId: remapped.id,
      ...(warnings.length > 0 ? { warnings } : {}),
    }
  } catch (error) {
    console.error("Error importing ASB definition:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "インポートに失敗しました",
    }
  } finally {
    if (tempDir) {
      cleanupAsbTempDir(tempDir)
    }
  }
}

export { cleanupAsbTempDir } from "./archiveExtractor"
