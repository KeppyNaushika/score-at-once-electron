/**
 * 小計グループのID統合処理
 */

import type {
  FileOverviewData,
  IdIntegrationConfig,
  IdIntegrationDecision,
  UpdateDecisions,
} from "../../../../../types/projectArchive.types"
import type { ExtractedArchiveData } from "../../project-archive/archiveExtractor"
import type {
  IdChangeTarget,
  IdMappings,
  ImportCounts,
  PrismaTransaction,
} from "../types"

/**
 * 小計グループのID統合処理を実行
 */
export async function processSubtotalGroupIdIntegration(
  data: ExtractedArchiveData,
  preMatchResult: FileOverviewData,
  config: IdIntegrationConfig["subtotalGroup"],
  idMappings: IdMappings,
  idChangeTargets: IdChangeTarget[],
  counts: ImportCounts,
  warnings: string[],
  tx: PrismaTransaction,
  updateDecisions?: UpdateDecisions
): Promise<void> {
  const groupPreMatch = preMatchResult.subtotalGroup

  // ID一致したもの
  for (const match of groupPreMatch.byId) {
    idMappings.subtotalGroup[match.importId] = match.existingId
  }

  const processDecision = async (
    importId: string,
    decision: IdIntegrationDecision | undefined,
    defaultExistingId: string | undefined
  ) => {
    const importGroup = data.subtotalsData.subtotalGroups.find(
      (g) => g.id === importId
    )
    if (!importGroup) return

    if (!decision || decision.decisionType === "create_new") {
      const existingByName = await tx.subtotalGroup.findFirst({
        where: { name: importGroup.name },
      })

      if (existingByName) {
        idMappings.subtotalGroup[importId] = existingByName.id
        warnings.push(
          `小計グループ「${importGroup.name}」は既存データを使用します`
        )
      } else {
        // scoreファイルのIDをそのまま使用（存在チェック付き）
        const existingById = await tx.subtotalGroup.findUnique({
          where: { id: importId },
        })
        if (existingById) {
          idMappings.subtotalGroup[importId] = importId
        } else {
          await tx.subtotalGroup.create({
            data: {
              id: importId,
              name: importGroup.name,
            },
          })
          idMappings.subtotalGroup[importId] = importId
          counts.created.subtotalGroups++
        }
      }
    } else if (decision.decisionType === "same_person") {
      const existingId = decision.existingId || defaultExistingId
      if (!existingId) {
        warnings.push(
          `小計グループ「${importGroup.name}」の既存IDが見つかりません`
        )
        return
      }

      idMappings.subtotalGroup[importId] = existingId

      // フィールド更新処理
      const updateKey = `subtotalGroup:${importId}`
      const fieldDecisions = updateDecisions?.[updateKey]
      if (fieldDecisions && importGroup) {
        const updateData: Record<string, unknown> = {}
        const fieldMap: Record<string, unknown> = {
          name: importGroup.name,
        }
        for (const [field, strategy] of Object.entries(fieldDecisions)) {
          if (strategy === "use_import" && field in fieldMap) {
            updateData[field] = fieldMap[field]
          } else if (strategy === "use_newer" && field in fieldMap) {
            const importUpdatedAt = importGroup.updatedAt
              ? new Date(importGroup.updatedAt)
              : null
            if (importUpdatedAt) {
              const existing = await tx.subtotalGroup.findUnique({
                where: { id: existingId },
              })
              if (existing && importUpdatedAt > existing.updatedAt) {
                updateData[field] = fieldMap[field]
              }
            }
          }
        }
        if (Object.keys(updateData).length > 0) {
          await tx.subtotalGroup.update({
            where: { id: existingId },
            data: updateData,
          })
          counts.updated.subtotalGroups++
        }
      }

      if (decision.idChoice === "use_import_id") {
        idChangeTargets.push({
          category: "subtotalGroup",
          existingId: existingId,
          newId: importId,
        })
      }
    } else if (decision.decisionType === "skip") {
      counts.skipped.subtotalGroups++
    }
  }

  // 名前一致
  if (groupPreMatch.byName) {
    for (const match of groupPreMatch.byName) {
      const decision = config.decisions.find(
        (d) => d.importId === match.importId
      )

      if (config.strategy === "by_name") {
        await processDecision(
          match.importId,
          decision || {
            importId: match.importId,
            decisionType: "same_person",
            existingId: match.existingId,
            idChoice: "use_existing_id",
          },
          match.existingId
        )
      } else if (config.strategy === "all_new") {
        await processDecision(
          match.importId,
          decision || {
            importId: match.importId,
            decisionType: "create_new",
          },
          undefined
        )
      } else {
        await processDecision(match.importId, decision, match.existingId)
      }
    }
  }

  // どれにも一致しない
  for (const item of groupPreMatch.noMatch) {
    if (idMappings.subtotalGroup[item.importId]) continue

    const decision = config.decisions.find((d) => d.importId === item.importId)
    await processDecision(
      item.importId,
      decision || {
        importId: item.importId,
        decisionType: "create_new",
      },
      undefined
    )
  }
}
