/**
 * 小計グループのID統合処理
 */

import { randomUUID } from "crypto"

import type {
  FileOverviewData,
  IdIntegrationConfig,
  IdIntegrationDecision,
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
  tx: PrismaTransaction
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
        const newId = randomUUID()
        await tx.subtotalGroup.create({
          data: {
            id: newId,
            name: importGroup.name,
          },
        })
        idMappings.subtotalGroup[importId] = newId
        counts.created.subtotalGroups++
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
