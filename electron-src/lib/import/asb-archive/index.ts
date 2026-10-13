/**
 * ASB定義インポート機能
 *
 * **id が一致すれば同じ解答用紙。** 定義と木の各行はアーカイブの id のまま書く
 * （replaceAsbDefinition は行を id で書き分ける）。同じ id の解答用紙が取り込み先に在れば、
 * 取り込みの規則（統合＝後に書かれた方）で置き換えるかを決め、置き換えないなら何も書かない。
 * 名前は付け替えない（同じ名前の解答用紙が並ぶのは正常で、id で区別する）。
 */

import { recordAuditLog } from "../../prisma/auditLog"
import prisma from "../../prisma/client"
import { transformAsbToLatest } from "../asb-transformers"
import { createImportValuePolicy } from "../merge/importValuePolicy"
import { archiveRowReplacedAt, isUuid } from "../shared/idFirstRow"
import { cleanupAsbTempDir, extractAsbArchive } from "./archiveExtractor"
import {
  copyImagesAndUpdatePaths,
  createImportedAsbDefinition,
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

    // 4. id はアーカイブのまま使う。旧形式の変換で合成した id（uuid でない）のときだけ振る
    const definitionToWrite = isUuid(transformedDefinition.id)
      ? transformedDefinition
      : remapDefinitionIds(
          transformedDefinition,
          generateAsbIdMappings(transformedDefinition)
        )

    // 5. 同じ id の解答用紙が在れば、規則で置き換えるかを決める（統合＝後に書かれた方）
    const existingDefinition = await prisma.asbDefinition.findUnique({
      where: { id: definitionToWrite.id },
    })
    if (existingDefinition) {
      const replacedAt = archiveRowReplacedAt(
        createImportValuePolicy("merge"),
        definitionToWrite.updatedAt,
        existingDefinition.updatedAt
      )
      if (!replacedAt) {
        warnings.push(
          `解答用紙「${existingDefinition.name}」はこのPCの方が新しいため、取り込みませんでした`
        )
        return { definitionId: existingDefinition.id, warnings }
      }
      warnings.push(
        `解答用紙「${existingDefinition.name}」はこのPCに既にあるため、取り込んだ内容で置き換えました`
      )
    }

    // 6. 画像コピー + パス更新（既にある解答用紙の画像は、失敗しても消さない）
    copyImagesAndUpdatePaths(definitionToWrite, imagePaths, {
      removeImagesOnFailure: !existingDefinition,
    })

    // 7. DB保存（定義本体 → タグ join）。タグ紐付け失敗は警告として返る
    const tagWarnings = await createImportedAsbDefinition(
      definitionToWrite,
      userId,
      transformedTagsData,
      transformedTags
    )
    warnings.push(...tagWarnings)

    await recordAuditLog({
      action: "answer_sheet.import",
      userId,
      entityType: "AsbDefinition",
      entityId: definitionToWrite.id,
      scopeId: definitionToWrite.id,
      scopeLabel: definitionToWrite.name,
      target: definitionToWrite.name,
    })

    return { definitionId: definitionToWrite.id, warnings }
  } catch (error) {
    console.error("Error importing ASB definition:", error)
    throw error
  } finally {
    if (tempDir) {
      cleanupAsbTempDir(tempDir)
    }
  }
}
