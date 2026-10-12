/**
 * 生徒・学級・小計グループに共通する、ID統合の判断の進め方
 *
 * どの行とどの行が同じかの照合結果（ID一致・学籍番号一致・名前一致・一致なし）と、
 * 人の判断・紐づけ方法から、行ごとに「同じ行に結ぶ／新しく作る／取り込まない」を決めて回す。
 * **行の値の書き込みと新規作成は表ごとに違う**ので、呼び出し側から関数で受け取る。
 */

import type {
  ArchiveDataCounts,
  CategoryIdIntegrationConfig,
  IdIntegrationDecision,
  ImportItem,
  MatchedItem,
} from "../../../../../src/types/examArchive.types"
import type { IdChangeTarget, IdMappings, ImportCounts } from "../types"

/**
 * 照合の一覧1つ（学籍番号一致・名前一致など）と、その一覧を「同じ行」と既定で
 * みなす紐づけ方法の組。
 */
interface MatchedItemGroup {
  matchedItems: MatchedItem[] | undefined
  /** この紐づけ方法のとき、判断の無い行は既存の行に結ぶ */
  sameRowStrategy: CategoryIdIntegrationConfig["strategy"]
  /** 先の一覧で既に対応が決まった行を飛ばす */
  skipAlreadyMapped: boolean
}

interface IdIntegrationRunOptions<ImportRow> {
  category: IdChangeTarget["category"]
  countKey: keyof ArchiveDataCounts
  importRowById: Map<string, ImportRow>
  idMatchedItems: MatchedItem[]
  /** 照合の一覧。並べた順に処理する */
  matchedItemGroups: MatchedItemGroup[]
  noMatchItems: ImportItem[]
  config: CategoryIdIntegrationConfig
  idMappings: IdMappings
  idChangeTargets: IdChangeTarget[]
  counts: ImportCounts
  warnings: string[]
  /** 警告に出す行の呼び名（例: 学級「1年1組」） */
  describeRow: (importRow: ImportRow) => string
  /** 同じだと決まった既存の行へ、アーカイブの値を規則に従って書き込む */
  applyColumns: (importRow: ImportRow, existingId: string) => Promise<void>
  /** 新しい行として作る（対応表への記録と件数の集計も含む） */
  createNewRow: (importRow: ImportRow, importId: string) => Promise<void>
}

/**
 * ID統合を、ID一致 → 照合の一覧（並べた順）→ 一致なし の順に実行する。
 */
export async function runIdIntegration<ImportRow>(
  options: IdIntegrationRunOptions<ImportRow>
): Promise<void> {
  const {
    category,
    countKey,
    importRowById,
    config,
    idMappings,
    idChangeTargets,
    counts,
    warnings,
    describeRow,
    applyColumns,
    createNewRow,
  } = options
  const mappedIds = idMappings[category]

  // ID一致したもの。同じ行なので値も規則に従って書き込む
  for (const idMatchedItem of options.idMatchedItems) {
    mappedIds[idMatchedItem.importId] = idMatchedItem.existingId
    const importRow = importRowById.get(idMatchedItem.importId)
    if (importRow) {
      await applyColumns(importRow, idMatchedItem.existingId)
    }
  }

  const processDecision = async (
    importId: string,
    decision: IdIntegrationDecision | undefined,
    defaultExistingId: string | undefined
  ) => {
    const importRow = importRowById.get(importId)
    if (!importRow) return

    if (!decision || decision.decisionType === "create_new") {
      await createNewRow(importRow, importId)
    } else if (decision.decisionType === "same_person") {
      const existingId = decision.existingId || defaultExistingId
      if (!existingId) {
        warnings.push(`${describeRow(importRow)}の既存IDが見つかりません`)
        return
      }

      mappedIds[importId] = existingId
      await applyColumns(importRow, existingId)

      if (decision.idChoice === "use_import_id") {
        // Stage 2でID変更を行う
        idChangeTargets.push({
          category,
          existingId: existingId,
          newId: importId,
        })
      }
    } else if (decision.decisionType === "skip") {
      counts.skipped[countKey]++
    }
  }

  const findDecision = (importId: string) =>
    config.decisions.find((decision) => decision.importId === importId)

  for (const matchedItemGroup of options.matchedItemGroups) {
    for (const matchedItem of matchedItemGroup.matchedItems ?? []) {
      if (matchedItemGroup.skipAlreadyMapped && mappedIds[matchedItem.importId])
        continue

      const decision = findDecision(matchedItem.importId)

      // strategyに応じたデフォルト処理
      if (config.strategy === matchedItemGroup.sameRowStrategy) {
        await processDecision(
          matchedItem.importId,
          decision || {
            importId: matchedItem.importId,
            decisionType: "same_person",
            existingId: matchedItem.existingId,
            idChoice: "use_existing_id",
          },
          matchedItem.existingId
        )
      } else if (config.strategy === "all_new") {
        await processDecision(
          matchedItem.importId,
          decision || {
            importId: matchedItem.importId,
            decisionType: "create_new",
          },
          undefined
        )
      } else {
        await processDecision(
          matchedItem.importId,
          decision,
          matchedItem.existingId
        )
      }
    }
  }

  // どれにも一致しない
  for (const noMatchItem of options.noMatchItems) {
    if (mappedIds[noMatchItem.importId]) continue

    await processDecision(
      noMatchItem.importId,
      findDecision(noMatchItem.importId) || {
        importId: noMatchItem.importId,
        decisionType: "create_new",
      },
      undefined
    )
  }
}
