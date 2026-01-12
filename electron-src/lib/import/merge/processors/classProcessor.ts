/**
 * 学級のID統合処理
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
 * 学級のID統合処理を実行
 */
export async function processClassIdIntegration(
  data: ExtractedArchiveData,
  preMatchResult: FileOverviewData,
  config: IdIntegrationConfig["class"],
  idMappings: IdMappings,
  idChangeTargets: IdChangeTarget[],
  counts: ImportCounts,
  warnings: string[],
  tx: PrismaTransaction
): Promise<void> {
  const classPreMatch = preMatchResult.class

  // ID一致したもの
  for (const match of classPreMatch.byId) {
    idMappings.class[match.importId] = match.existingId
  }

  const processDecision = async (
    importId: string,
    decision: IdIntegrationDecision | undefined,
    defaultExistingId: string | undefined
  ) => {
    const importClass = data.classesData.classes.find((c) => c.id === importId)
    if (!importClass) return

    if (!decision || decision.decisionType === "create_new") {
      const existingByName = await tx.class.findUnique({
        where: { name: importClass.name },
      })

      if (existingByName) {
        idMappings.class[importId] = existingByName.id
        warnings.push(`学級「${importClass.name}」は既存データを使用します`)
      } else {
        const newId = randomUUID()
        await tx.class.create({
          data: {
            id: newId,
            name: importClass.name,
            classCode: importClass.classCode,
            grade: importClass.grade,
            description: importClass.description,
          },
        })
        idMappings.class[importId] = newId
        counts.created.classes++
      }
    } else if (decision.decisionType === "same_person") {
      const existingId = decision.existingId || defaultExistingId
      if (!existingId) {
        warnings.push(`学級「${importClass.name}」の既存IDが見つかりません`)
        return
      }

      idMappings.class[importId] = existingId

      if (decision.idChoice === "use_import_id") {
        idChangeTargets.push({
          category: "class",
          existingId: existingId,
          newId: importId,
        })
      }
    } else if (decision.decisionType === "skip") {
      counts.skipped.classes++
    }
  }

  // 名前一致
  if (classPreMatch.byName) {
    for (const match of classPreMatch.byName) {
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
  for (const item of classPreMatch.noMatch) {
    if (idMappings.class[item.importId]) continue

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
