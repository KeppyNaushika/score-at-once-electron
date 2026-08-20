/**
 * ASB定義エクスポート機能
 */

import { dialog } from "electron"

import type { ArchiveAsbTag } from "../../../../src/types/asbArchive.types"
import { getAsbDefinition } from "../../prisma/asbDefinition"
import { getAsbDefinitionTags } from "../../prisma/asbDefinitionTag"
import { recordAuditLog } from "../../prisma/auditLog"
import type { FileExportResult } from "../../shared/types"
import { createAsbArchive, generateAsbExportFileName } from "./archiveCreator"
import { collectAsbData } from "./dataCollector"

/**
 * 解答用紙定義をエクスポート
 *
 * 画像の実体が見つからなくてもアーカイブは作られる（壊れてはいない）。欠けたものは
 * `missingFiles` で返し、監査ログにも残す。
 */
export async function exportAsbDefinition(
  definitionId: string
): Promise<FileExportResult> {
  try {
    // 1. 定義を取得
    const definition = await getAsbDefinition(definitionId)
    if (!definition) {
      throw new Error("定義が見つかりません")
    }

    // 2. データ収集（タグ本体を同梱）
    const asbDefinitionTags = await getAsbDefinitionTags(definitionId)
    const tagsData: ArchiveAsbTag[] = asbDefinitionTags.map(
      (asbDefinitionTag) => ({
        id: asbDefinitionTag.tag.id,
        name: asbDefinitionTag.tag.name,
        order: asbDefinitionTag.tag.order,
        color: asbDefinitionTag.tag.color,
      })
    )
    const collected = collectAsbData(definition, tagsData)

    // 3. 保存先を選択
    const defaultFileName = generateAsbExportFileName(definition.name)
    const result = await dialog.showSaveDialog({
      title: "解答用紙定義を書き出し",
      defaultPath: defaultFileName,
      filters: [{ name: "解答用紙定義", extensions: ["asb"] }],
    })

    // 保存先を選ばずに閉じたのは失敗ではない
    if (result.canceled || !result.filePath) {
      return { canceled: true }
    }

    // 4. アーカイブを作成
    const archiveResult = await createAsbArchive(collected, result.filePath)

    if (!archiveResult.success || !archiveResult.outputPath) {
      throw new Error(archiveResult.error ?? "書き出しに失敗しました")
    }

    await recordAuditLog({
      action: "answer_sheet.export",
      entityType: "AsbDefinition",
      entityId: definitionId,
      scopeId: definitionId,
      scopeLabel: definition.name,
      target: definition.name,
      extra: {
        outputPath: archiveResult.outputPath,
        // 欠けたまま書き出したなら、記録にも残す（成功としてだけ残さない）
        ...(archiveResult.missingFiles.length > 0 && {
          missingFiles: archiveResult.missingFiles,
        }),
      },
    })

    return {
      canceled: false,
      outputPath: archiveResult.outputPath,
      missingFiles: archiveResult.missingFiles,
    }
  } catch (error) {
    console.error("Error exporting ASB definition:", error)
    throw error
  }
}
