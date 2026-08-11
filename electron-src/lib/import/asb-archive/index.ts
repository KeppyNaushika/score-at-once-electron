/**
 * ASB定義インポート機能
 */

import { recordAuditLog } from "../../prisma/auditLog"
import { transformAsbToLatest } from "../asb-transformers"
import { cleanupAsbTempDir, extractAsbArchive } from "./archiveExtractor"
import {
  copyImagesAndUpdatePaths,
  createImportedAsbDefinition,
  resolveNameConflict,
} from "./dataCreator"
import { generateAsbIdMappings, remapDefinitionIds } from "./idRemapper"
import { validateAsbManifest } from "./manifestValidator"

/**
 * ASBアーカイブをインポート
 */
export async function importAsbDefinition(
  filePath: string,
  userId: string
): Promise<{ definitionId: string; warnings: string[] }> {
  let tempDir: string | undefined

  try {
    // 1. 展開
    const extractResult = await extractAsbArchive(filePath)
    if (!extractResult.success || !extractResult.data) {
      throw new Error(extractResult.error ?? "アーカイブを展開できません")
    }
    tempDir = extractResult.data.tempDir

    const { manifest, definition, imagePaths, tagsData, asbDefinitionTags } =
      extractResult.data

    // 2. マニフェスト検証
    const validation = validateAsbManifest(manifest)
    if (!validation.valid) {
      throw new Error(validation.error ?? "アーカイブの形式が不正です")
    }

    // 3. バージョン変換
    const transformResult = transformAsbToLatest({
      manifest,
      definition,
      tagsData,
      asbDefinitionTags,
    })
    const warnings = [...transformResult.warnings]
    const transformedDefinition = transformResult.data.definition
    const transformedTagsData = transformResult.data.tagsData ?? []
    const transformedTags = transformResult.data.asbDefinitionTags ?? []

    // 4. IDリマッピング
    const mappings = generateAsbIdMappings(transformedDefinition)
    const remapped = remapDefinitionIds(transformedDefinition, mappings)

    // 5. 名前重複チェック
    remapped.name = await resolveNameConflict(remapped.name, userId)

    // 6. 画像コピー + パス更新
    copyImagesAndUpdatePaths(remapped, imagePaths)

    // 7. DB保存（定義本体 → タグ join）。タグ紐付け失敗は警告として返る
    const tagWarnings = await createImportedAsbDefinition(
      remapped,
      userId,
      transformedTagsData,
      transformedTags
    )
    warnings.push(...tagWarnings)

    await recordAuditLog({
      action: "answer_sheet.import",
      userId,
      entityType: "AsbDefinition",
      entityId: remapped.id,
      scopeId: remapped.id,
      scopeLabel: remapped.name,
      target: remapped.name,
    })

    return { definitionId: remapped.id, warnings }
  } catch (error) {
    console.error("Error importing ASB definition:", error)
    throw error
  } finally {
    if (tempDir) {
      cleanupAsbTempDir(tempDir)
    }
  }
}
