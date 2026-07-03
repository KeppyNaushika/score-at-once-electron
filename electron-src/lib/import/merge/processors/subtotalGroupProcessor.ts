/**
 * 小計グループのID統合処理
 */

import { randomUUID } from "crypto"

import type {
  FileOverviewData,
  IdIntegrationConfig,
  IdIntegrationDecision,
  UpdateDecisions,
} from "../../../../../src/types/examArchive.types"
import type { ExtractedArchiveData } from "../../exam-archive/archiveExtractor"
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
      (group) => group.id === importId
    )
    if (!importGroup) return

    if (!decision || decision.decisionType === "create_new") {
      const existingByName = await tx.subtotalGroup.findFirst({
        where: { name: importGroup.name },
      })

      if (existingByName) {
        // B5修正: create_new の意図を尊重し、サフィックス付きで新規作成
        const newName = await generateUniqueName(importGroup.name, tx)
        const newId = randomUUID()
        await tx.subtotalGroup.create({
          data: {
            id: newId,
            name: newName,
          },
        })
        idMappings.subtotalGroup[importId] = newId
        counts.created.subtotalGroups++
        warnings.push(
          `小計グループ「${importGroup.name}」は同名のグループが存在するため「${newName}」として新規作成しました`
        )
      } else {
        // scoreファイルのIDをそのまま使用（存在チェック付き）
        const existingById = await tx.subtotalGroup.findUnique({
          where: { id: importId },
        })
        if (existingById) {
          // IDが衝突する場合は新規IDで作成
          const newId = randomUUID()
          await tx.subtotalGroup.create({
            data: {
              id: newId,
              name: importGroup.name,
            },
          })
          idMappings.subtotalGroup[importId] = newId
          counts.created.subtotalGroups++
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
        (decision) => decision.importId === match.importId
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

    const decision = config.decisions.find(
      (decision) => decision.importId === item.importId
    )
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

/**
 * 同名の小計グループが存在する場合にサフィックス付きのユニーク名を生成
 * 例: "大問" → "大問 (2)", "大問 (2)" → "大問 (3)"
 */
async function generateUniqueName(
  baseName: string,
  tx: PrismaTransaction
): Promise<string> {
  for (let i = 2; i <= 100; i++) {
    const candidate = `${baseName} (${i})`
    const existing = await tx.subtotalGroup.findFirst({
      where: { name: candidate },
    })
    if (!existing) return candidate
  }
  // フォールバック: ランダム名
  return `${baseName} (${randomUUID().slice(0, 8)})`
}
