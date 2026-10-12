/**
 * 小計グループのID統合処理
 *
 * どのグループとどのグループが同じかを決めるのがここ。
 * **同じだと決まった行の値をどうするかは importValuePolicy に一本化されている**
 * （上書きする／統合する／別で追加する）。項目ごとの選択は持たない。
 */

import * as crypto from "crypto"

import type {
  FileOverviewData,
  IdIntegrationConfig,
} from "../../../../../src/types/examArchive.types"
import type { ExtractedArchiveData } from "../../exam-archive/archiveExtractor"
import type { ImportValuePolicy } from "../importValuePolicy"
import { replacementUpdatedAt } from "../importValuePolicy"
import type {
  IdChangeTarget,
  IdMappings,
  ImportCounts,
  PrismaTransaction,
} from "../types"
import { runIdIntegration } from "./idIntegrationRunner"

/** アーカイブ側の小計グループ1行 */
type ArchiveSubtotalGroup =
  ExtractedArchiveData["subtotalsData"]["subtotalGroups"][number]

/**
 * 同じだと決まった既存のグループへ、アーカイブの値を規則に従って書き込む。
 *
 * SubtotalGroup の列は id / name / createdAt / updatedAt で全部。
 * id と createdAt は動かさない。列を足したらここにも足すこと。
 */
async function applySubtotalGroupColumns(
  importGroup: ArchiveSubtotalGroup,
  existingId: string,
  policy: ImportValuePolicy,
  counts: ImportCounts,
  tx: PrismaTransaction
): Promise<void> {
  const existing = await tx.subtotalGroup.findUnique({
    where: { id: existingId },
  })
  if (!existing) return

  const updatedAt = replacementUpdatedAt(
    policy,
    importGroup.updatedAt,
    existing.updatedAt
  )
  if (!updatedAt) return

  await tx.subtotalGroup.update({
    where: { id: existingId },
    data: { name: importGroup.name, updatedAt },
  })
  counts.updated.subtotalGroups++
}

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
  policy: ImportValuePolicy,
  tx: PrismaTransaction
): Promise<void> {
  const groupPreMatch = preMatchResult.subtotalGroup

  await runIdIntegration({
    category: "subtotalGroup",
    countKey: "subtotalGroups",
    importRowById: new Map(
      data.subtotalsData.subtotalGroups.map((group) => [group.id, group])
    ),
    idMatchedItems: groupPreMatch.byId,
    matchedItemGroups: [
      // 名前一致
      {
        matchedItems: groupPreMatch.byName,
        sameRowStrategy: "by_name",
        skipAlreadyMapped: false,
      },
    ],
    noMatchItems: groupPreMatch.noMatch,
    config,
    idMappings,
    idChangeTargets,
    counts,
    warnings,
    describeRow: (importGroup) => `小計グループ「${importGroup.name}」`,
    applyColumns: (importGroup, existingId) =>
      applySubtotalGroupColumns(importGroup, existingId, policy, counts, tx),
    createNewRow: async (importGroup, importId) => {
      // 名前はアーカイブの値のまま作る。同じ名前のグループが並ぶのは正常で、id で区別する
      // （見分けるのは画面の役目）。id はアーカイブの id を使い、既に使われているときだけ振り直す
      const existingById = await tx.subtotalGroup.findUnique({
        where: { id: importId },
      })
      const newId = existingById ? crypto.randomUUID() : importId
      await tx.subtotalGroup.create({
        data: {
          id: newId,
          name: importGroup.name,
          ...policy.createdTimestamps(importGroup),
        },
      })
      idMappings.subtotalGroup[importId] = newId
      counts.created.subtotalGroups++
    },
  })
}
