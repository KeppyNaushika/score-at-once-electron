/**
 * 生徒・学級・小計グループに共通する、ID統合の判断の進め方
 *
 * どの行とどの行が同じかの照合結果（ID一致・学籍番号一致・名前一致・一致なし）と、
 * 人の判断・紐づけ方法から、行ごとに「同じ行に結ぶ／新しく作る／取り込まない」を決めて回す。
 * **行の値の書き込みと新規作成は表ごとに違う**ので、呼び出し側から関数で受け取る。
 *
 * - **id が一致すれば同じ行**。事前照合の結果ではなく、実行の時点で取り込み先を id で引いて
 *   決める（照合から実行までの間に同期などで行が入ってくることがある）。id が一致した行には
 *   人の判断も紐づけ方法も当てない
 * - 照合の一覧（学籍番号一致・氏名一致など）は重なってよい（同じ生徒が両方に載る）。
 *   選んだ紐づけ方法の一覧から先に回し、1行は1回だけ決める。紐づけ方法と違う一覧にだけ
 *   載っていて人の判断も無い行は、新しく作る
 * - 1つの既存の行に結ぶアーカイブの行は1つだけ。既に他の行が取った既存の行には結ばず、
 *   新しく作って警告に残す
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
}

interface IdIntegrationRunOptions<ImportRow> {
  category: IdChangeTarget["category"]
  countKey: keyof ArchiveDataCounts
  importRowById: Map<string, ImportRow>
  /** 照合の一覧。紐づけ方法に当たる一覧を先に、残りは並べた順に処理する */
  matchedItemGroups: MatchedItemGroup[]
  noMatchItems: ImportItem[]
  config: CategoryIdIntegrationConfig
  idMappings: IdMappings
  idChangeTargets: IdChangeTarget[]
  counts: ImportCounts
  warnings: string[]
  /** 警告に出す行の呼び名（例: 学級「1年1組」） */
  describeRow: (importRow: ImportRow) => string
  /** 取り込み先に、この id の行があるか */
  existsById: (id: string) => Promise<boolean>
  /** 同じだと決まった既存の行へ、アーカイブの値を規則に従って書き込む */
  applyColumns: (importRow: ImportRow, existingId: string) => Promise<void>
  /**
   * 新しい行として作る（アーカイブの id で。対応表への記録と件数の集計も含む）。
   * 取り込み先にその id が無いことは呼び出し側（このランナー）が確かめてある
   */
  createNewRow: (importRow: ImportRow, importId: string) => Promise<void>
}

/**
 * ID統合を、ID一致 → 照合の一覧 → 一致なし の順に実行する。
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
    existsById,
    applyColumns,
    createNewRow,
  } = options
  const mappedIds = idMappings[category]
  /** 決め終えたアーカイブの行 */
  const handledImportIds = new Set<string>()
  /** 既存の行 → それを取ったアーカイブの行 */
  const claimedBy = new Map<string, string>()

  // 取り込み先に同じ id の行があるアーカイブの行は、同じ行として先に結ぶ。
  // 事前照合で id が一致した行に限らず、全ての行を実行の時点で引き直す
  for (const [importId, importRow] of importRowById) {
    if (!(await existsById(importId))) continue
    mappedIds[importId] = importId
    claimedBy.set(importId, importId)
    handledImportIds.add(importId)
    await applyColumns(importRow, importId)
  }

  const createNew = async (importRow: ImportRow, importId: string) => {
    handledImportIds.add(importId)
    await createNewRow(importRow, importId)
  }

  const processDecision = async (
    importId: string,
    decision: IdIntegrationDecision | undefined,
    defaultExistingId: string | undefined
  ) => {
    const importRow = importRowById.get(importId)
    if (!importRow || handledImportIds.has(importId)) return

    if (!decision || decision.decisionType === "create_new") {
      await createNew(importRow, importId)
    } else if (decision.decisionType === "same_person") {
      const existingId = decision.existingId || defaultExistingId
      if (!existingId || !(await existsById(existingId))) {
        warnings.push(
          `${describeRow(importRow)}の紐づけ先がこのPCに見つからないため、新しく登録しました`
        )
        await createNew(importRow, importId)
        return
      }
      const claimant = claimedBy.get(existingId)
      if (claimant !== undefined && claimant !== importId) {
        warnings.push(
          `${describeRow(importRow)}の紐づけ先は、取り込む別の行が既に使っているため、新しく登録しました`
        )
        await createNew(importRow, importId)
        return
      }

      handledImportIds.add(importId)
      claimedBy.set(existingId, importId)
      mappedIds[importId] = existingId
      await applyColumns(importRow, existingId)

      if (decision.idChoice === "use_import_id") {
        // 全て書き終えてから id を変える（idChangeExecutor）
        idChangeTargets.push({
          category,
          existingId: existingId,
          newId: importId,
        })
      }
    } else if (decision.decisionType === "skip") {
      handledImportIds.add(importId)
      counts.skipped[countKey]++
    }
  }

  const findDecision = (importId: string) =>
    config.decisions.find((decision) => decision.importId === importId)

  // 紐づけ方法に当たる一覧を先に回す（同じ行が別の一覧にも載っているときに、
  // 紐づけ方法の方の候補で決めるため）
  const orderedGroups = [
    ...options.matchedItemGroups.filter(
      (group) => group.sameRowStrategy === config.strategy
    ),
    ...options.matchedItemGroups.filter(
      (group) => group.sameRowStrategy !== config.strategy
    ),
  ]
  for (const matchedItemGroup of orderedGroups) {
    for (const matchedItem of matchedItemGroup.matchedItems ?? []) {
      if (handledImportIds.has(matchedItem.importId)) continue
      const decision = findDecision(matchedItem.importId)

      if (decision) {
        await processDecision(
          matchedItem.importId,
          decision,
          matchedItem.existingId
        )
      } else if (config.strategy === matchedItemGroup.sameRowStrategy) {
        await processDecision(
          matchedItem.importId,
          {
            importId: matchedItem.importId,
            decisionType: "same_person",
            existingId: matchedItem.existingId,
            idChoice: "use_existing_id",
          },
          matchedItem.existingId
        )
      }
      // 紐づけ方法と違う一覧の、判断の無い行は後の一覧に任せる（どこでも決まらなければ新規）
    }
  }

  // 照合の一覧のどれでも決まらなかった行と、どれにも一致しない行
  const remainingImportIds = [
    ...options.matchedItemGroups.flatMap((group) =>
      (group.matchedItems ?? []).map((matchedItem) => matchedItem.importId)
    ),
    ...options.noMatchItems.map((noMatchItem) => noMatchItem.importId),
    // 事前照合の後に取り込み先から消えた行など、どの一覧にも載っていない行
    ...importRowById.keys(),
  ]
  for (const importId of remainingImportIds) {
    if (handledImportIds.has(importId)) continue
    await processDecision(importId, findDecision(importId), undefined)
  }
}
