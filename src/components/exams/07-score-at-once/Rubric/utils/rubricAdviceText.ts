/**
 * 答案に当たっている項目から、朱書きにする助言の文を決める（docs/vlm-grading-design.md §4-7）。
 *
 * - 助言（`adviceText`）のある項目が当たっていなければ、朱書きなし
 * - 1つだけ当たっていれば、その項目の助言
 * - 2つ以上当たっていれば、その項目の集合の決まり（`RubricAdviceCombination`）に従う。
 *   決まりが無ければ「未決定」（朱書きは作らず、左のパネルで問いかける）
 *
 * 組み合わせの同定は項目の集合の一致で行う。同期で同じ集合の決まりが2つあれば、
 * いちばん新しく直されたものを採る。
 */

import type {
  RubricAdviceCombinationRow,
  RubricItemRow,
} from "@/queries/rubric"
import type { RubricAdviceCombinationMode } from "@/types/rubric.types"

/** 助言を決めるのに読む項目の列 */
export type AdviceRubricItem = Pick<
  RubricItemRow,
  "id" | "label" | "adviceText"
>

/** 助言を決めるのに読む決まりの列 */
export type AdviceCombinationRule = Pick<
  RubricAdviceCombinationRow,
  "id" | "mode" | "mergedText" | "primaryRubricItemId" | "updatedAt"
> & {
  items: Pick<RubricAdviceCombinationRow["items"][number], "rubricItemId">[]
}

/** 重なった助言の扱い（決まりの中身、または選択の場面で選ぶもの） */
export type AdviceChoice =
  | { mode: "merged"; mergedText: string }
  | { mode: "single"; primaryRubricItemId: string }
  | { mode: Extract<RubricAdviceCombinationMode, "all" | "none"> }

/** 答案の朱書きの決まり方 */
export type RubricAdviceResolution =
  | { kind: "none" }
  | { kind: "text"; text: string }
  /** 助言のある項目が2つ以上当たっていて、その集合の決まりが無い */
  | { kind: "undecided"; itemIds: string[] }

const hasAdvice = (rubricItem: AdviceRubricItem) =>
  rubricItem.adviceText.trim() !== ""

/**
 * 当たっている項目のうち、助言のあるものの id（項目の並び順）。
 * もう無い項目（消された）は数えない
 */
export function adviceItemIdsOf(
  appliedItemIds: Iterable<string>,
  rubricItems: readonly AdviceRubricItem[]
): string[] {
  const appliedIdSet = new Set(appliedItemIds)
  return rubricItems
    .filter((rubricItem) => appliedIdSet.has(rubricItem.id))
    .filter(hasAdvice)
    .map((rubricItem) => rubricItem.id)
}

/** 2つの id の並びが、集合として同じか */
export function isSameItemSet(
  itemIdsA: readonly string[],
  itemIdsB: readonly string[]
): boolean {
  const setA = new Set(itemIdsA)
  const setB = new Set(itemIdsB)
  return setA.size === setB.size && [...setA].every((id) => setB.has(id))
}

/** 項目の集合の決まり（同じ集合が2つあれば、いちばん新しく直されたもの）。無ければ null */
export function findAdviceCombination<Rule extends AdviceCombinationRule>(
  itemIds: readonly string[],
  combinations: readonly Rule[]
): Rule | null {
  return combinations
    .filter((combination) =>
      isSameItemSet(
        combination.items.map((item) => item.rubricItemId),
        itemIds
      )
    )
    .reduce<Rule | null>(
      (latest, combination) =>
        !latest ||
        new Date(combination.updatedAt).getTime() >
          new Date(latest.updatedAt).getTime()
          ? combination
          : latest,
      null
    )
}

/**
 * 決まりの行を、扱いにする。中身が欠けている（まとめた一文が空・採る項目が集合に無い）
 * 決まりは null（未決定と同じに扱う）
 */
function toAdviceChoice(rule: AdviceCombinationRule): AdviceChoice | null {
  const itemIds = rule.items.map((item) => item.rubricItemId)
  switch (rule.mode) {
    case "merged":
      return rule.mergedText.trim() === ""
        ? null
        : { mode: "merged", mergedText: rule.mergedText }
    case "single":
      return rule.primaryRubricItemId !== null &&
        itemIds.includes(rule.primaryRubricItemId)
        ? { mode: "single", primaryRubricItemId: rule.primaryRubricItemId }
        : null
    case "all":
      return { mode: "all" }
    case "none":
      return { mode: "none" }
    default:
      return null
  }
}

/**
 * 扱いから朱書きの文を作る。朱書きなしなら null。
 * 並べるときは、項目の並び順に助言を1段落ずつ置く（改行は段落の区切り）
 */
export function adviceTextOfChoice(
  choice: AdviceChoice,
  itemIds: readonly string[],
  rubricItems: readonly AdviceRubricItem[]
): string | null {
  const adviceOf = (rubricItemId: string) =>
    rubricItems.find((rubricItem) => rubricItem.id === rubricItemId)
      ?.adviceText ?? ""
  const text = (() => {
    switch (choice.mode) {
      case "merged":
        return choice.mergedText
      case "single":
        return adviceOf(choice.primaryRubricItemId)
      case "all":
        return rubricItems
          .filter((rubricItem) => itemIds.includes(rubricItem.id))
          .map((rubricItem) => rubricItem.adviceText.trim())
          .filter((adviceText) => adviceText !== "")
          .join("\n")
      case "none":
        return ""
    }
  })()
  return text.trim() === "" ? null : text.trim()
}

/** 答案に当たっている項目から、朱書きの決まり方を求める */
export function resolveRubricAdvice(
  appliedItemIds: Iterable<string>,
  rubricItems: readonly AdviceRubricItem[],
  combinations: readonly AdviceCombinationRule[]
): RubricAdviceResolution {
  const itemIds = adviceItemIdsOf(appliedItemIds, rubricItems)
  if (itemIds.length === 0) return { kind: "none" }
  if (itemIds.length === 1) {
    const text = adviceTextOfChoice({ mode: "all" }, itemIds, rubricItems)
    return text === null ? { kind: "none" } : { kind: "text", text }
  }
  const rule = findAdviceCombination(itemIds, combinations)
  const choice = rule ? toAdviceChoice(rule) : null
  if (!choice) return { kind: "undecided", itemIds }
  const text = adviceTextOfChoice(choice, itemIds, rubricItems)
  return text === null ? { kind: "none" } : { kind: "text", text }
}

/** 未決定の組み合わせ1つと、それに当たる答案 */
export interface UndecidedAdviceCombination {
  /** 組み合わせを作る項目（項目の並び順） */
  itemIds: string[]
  examStudentIds: string[]
}

/** 決まりを求める答案（受験者と、自分の採点行に当たっている項目） */
interface AdviceCell {
  examStudentId: string
  appliedItemIds: ReadonlySet<string>
}

/**
 * 未決定の組み合わせを、当たる答案とともに洗い出す（組み合わせの最初の項目の並び順。
 * 同じ組み合わせの答案は1つにまとめる）
 */
export function findUndecidedAdviceCombinations(
  cells: readonly AdviceCell[],
  rubricItems: readonly AdviceRubricItem[],
  combinations: readonly AdviceCombinationRule[]
): UndecidedAdviceCombination[] {
  const undecided: UndecidedAdviceCombination[] = []
  cells.forEach((cell) => {
    const resolution = resolveRubricAdvice(
      cell.appliedItemIds,
      rubricItems,
      combinations
    )
    if (resolution.kind !== "undecided") return
    const existing = undecided.find((combination) =>
      isSameItemSet(combination.itemIds, resolution.itemIds)
    )
    if (existing) existing.examStudentIds.push(cell.examStudentId)
    else
      undecided.push({
        itemIds: resolution.itemIds,
        examStudentIds: [cell.examStudentId],
      })
  })
  const orderOf = (rubricItemId: string) =>
    rubricItems.findIndex((rubricItem) => rubricItem.id === rubricItemId)
  return undecided.toSorted(
    (combinationA, combinationB) =>
      orderOf(combinationA.itemIds[0]) - orderOf(combinationB.itemIds[0]) ||
      combinationA.itemIds.length - combinationB.itemIds.length
  )
}
