/**
 * 旧形式の取り込み（.score / .students）の照合で、id で一致しなかった行ごとに、取り込み時に
 * どう扱われるかを決める（画面・件数の見込み・変更の見込みの共通の元）。
 *
 * 決まり方は main の `idIntegrationRunner.ts` と同じ:
 * 1. 人の判断があればそれ
 * 2. 無ければ、紐づけ方法に当たる照合の一覧（学籍番号一致・名前一致）に載っていれば、その一覧の
 *    先頭の候補へ「同じもの・このPCの id」
 * 3. どれでもなければ新しく作る
 *
 * 照合の一覧は重なってよい（同じ生徒が学籍番号一致と氏名一致の両方に載る）。行は1つにまとめる。
 * id で一致した行（byId）はここに含めない（必ず同じ行で、人が決めることは無い）。
 */

import type {
  CategoryIdIntegrationConfig,
  IdIntegrationDecision,
  MatchCandidate,
  MatchedItem,
  PreMatchingResult,
  SubtotalInfo,
} from "@/types/examArchive.types"

/** 照合の一覧の種類 */
export type MatchListKey = "byStudentNumber" | "byName"

/** 紐づけ方法 → 既定で同じものとみなす一覧 */
const STRATEGY_MATCH_LIST: Partial<
  Record<CategoryIdIntegrationConfig["strategy"], MatchListKey>
> = {
  by_student_number: "byStudentNumber",
  by_name: "byName",
}

export interface IdIntegrationRow {
  importId: string
  displayLabel: string
  importData: Record<string, unknown>
  /** 当たった一覧ごとの照合結果（当たらなければ空） */
  matches: { listKey: MatchListKey; matchedItem: MatchedItem }[]
  /** 照合の候補（当たった一覧の順、重複なし） */
  candidates: MatchCandidate[]
  /** 取り込み時の扱い。same_person なら existingId が必ず入る */
  decision: IdIntegrationDecision
  /** 人の判断ではなく既定で決まった扱いか */
  isDefault: boolean
  /** 小計グループの配下の小計項目（取り込み側） */
  importSubtotals: SubtotalInfo[] | undefined
}

/** id で一致しなかった行を、照合の一覧と人の判断から1行ずつにまとめる */
export function resolveIdIntegrationRows(
  preMatch: PreMatchingResult,
  config: CategoryIdIntegrationConfig
): IdIntegrationRow[] {
  const strategyListKey = STRATEGY_MATCH_LIST[config.strategy]
  const listKeys: MatchListKey[] = [
    ...(strategyListKey ? [strategyListKey] : []),
    ...(["byStudentNumber", "byName"] as const).filter(
      (listKey) => listKey !== strategyListKey
    ),
  ]
  const decisionByImportId = new Map(
    config.decisions.map((decision) => [decision.importId, decision])
  )

  const rows = new Map<string, IdIntegrationRow>()
  const rowOf = (
    importId: string,
    displayLabel: string,
    importData: Record<string, unknown>,
    importSubtotals: SubtotalInfo[] | undefined
  ): IdIntegrationRow => {
    const known = rows.get(importId)
    if (known) return known
    const row: IdIntegrationRow = {
      importId,
      displayLabel,
      importData,
      matches: [],
      candidates: [],
      decision: { importId, decisionType: "create_new" },
      isDefault: true,
      importSubtotals,
    }
    rows.set(importId, row)
    return row
  }

  for (const listKey of listKeys) {
    for (const matchedItem of preMatch[listKey] ?? []) {
      const row = rowOf(
        matchedItem.importId,
        matchedItem.displayLabel,
        matchedItem.importData,
        matchedItem.additionalInfo?.importSubtotals
      )
      row.matches.push({ listKey, matchedItem })
      for (const candidate of matchedItem.candidates) {
        if (
          !row.candidates.some(
            (known) => known.existingId === candidate.existingId
          )
        ) {
          row.candidates.push(candidate)
        }
      }
    }
  }
  for (const noMatchItem of preMatch.noMatch) {
    rowOf(
      noMatchItem.importId,
      noMatchItem.displayLabel,
      noMatchItem.importData,
      noMatchItem.additionalInfo?.importSubtotals
    )
  }

  return [...rows.values()].map((row) => {
    const decision = decisionByImportId.get(row.importId)
    if (decision) {
      const existingId =
        decision.decisionType === "same_person"
          ? (decision.existingId ?? row.candidates[0]?.existingId)
          : undefined
      return {
        ...row,
        decision:
          decision.decisionType === "same_person" && !existingId
            ? { importId: row.importId, decisionType: "create_new" }
            : { ...decision, existingId },
        isDefault: false,
      }
    }
    const strategyMatch = row.matches.find(
      (match) => match.listKey === strategyListKey
    )
    return strategyMatch
      ? {
          ...row,
          decision: {
            importId: row.importId,
            decisionType: "same_person",
            existingId: strategyMatch.matchedItem.existingId,
            idChoice: "use_existing_id",
          },
        }
      : row
  })
}

/** 行の id → 既存の行（照合の候補と手で選べる既存の行から引く） */
export function existingRowsById(
  preMatch: PreMatchingResult
): Map<string, Record<string, unknown>> {
  const existingRows = new Map<string, Record<string, unknown>>()
  for (const existingItem of preMatch.allExistingItems ?? []) {
    existingRows.set(existingItem.id, existingItem.existingData)
  }
  for (const matchedItem of [
    ...preMatch.byId,
    ...(preMatch.byStudentNumber ?? []),
    ...(preMatch.byName ?? []),
  ]) {
    for (const candidate of matchedItem.candidates) {
      existingRows.set(candidate.existingId, candidate.existingData)
    }
  }
  return existingRows
}
