/**
 * 重なった助言の問いかけの選択肢（docs/vlm-grading-design.md §3-7・§4-7）。
 *
 * 並びは「まとめた一文」→「○○の助言だけ」（項目ごと、項目の並び順）→「すべて並べる」→
 * 「朱書きなし」。選択の場面ではこの順に 1 から番号を振る。
 * まとめた一文は教員が書く（AI に作らせるのは後の段）。
 */

import type { AdviceChoice, AdviceCombinationRule } from "./rubricAdviceText"

/** 選択肢1つ */
export type AdviceOption =
  | { kind: "merged" }
  | { kind: "single"; rubricItemId: string }
  | { kind: "all" }
  | { kind: "none" }

/** 組み合わせの選択肢（`itemIds` は項目の並び順） */
export function listAdviceOptions(itemIds: readonly string[]): AdviceOption[] {
  return [
    { kind: "merged" },
    ...itemIds.map((rubricItemId): AdviceOption => ({
      kind: "single",
      rubricItemId,
    })),
    { kind: "all" },
    { kind: "none" },
  ]
}

/** 選択肢を扱いにする。まとめた一文は書いた文で */
export function toAdviceChoiceOfOption(
  option: AdviceOption,
  mergedText: string
): AdviceChoice {
  switch (option.kind) {
    case "merged":
      return { mode: "merged", mergedText }
    case "single":
      return { mode: "single", primaryRubricItemId: option.rubricItemId }
    case "all":
      return { mode: "all" }
    case "none":
      return { mode: "none" }
  }
}

/** 決まりに当たる選択肢の位置（決まりが無い・当たらなければ 0） */
export function optionIndexOfRule(
  options: readonly AdviceOption[],
  rule: AdviceCombinationRule | null
): number {
  if (!rule) return 0
  const index = options.findIndex((option) =>
    option.kind === "single"
      ? rule.mode === "single" &&
        rule.primaryRubricItemId === option.rubricItemId
      : option.kind === rule.mode
  )
  return Math.max(0, index)
}

/** 決まりの扱いの短い名前（決まりの一覧に出す） */
export function adviceRuleLabel(
  rule: AdviceCombinationRule,
  nameOfItem: (rubricItemId: string) => string
): string {
  switch (rule.mode) {
    case "merged":
      return `まとめた一文「${rule.mergedText}」`
    case "single":
      return rule.primaryRubricItemId === null
        ? "1つの助言だけ"
        : `${nameOfItem(rule.primaryRubricItemId)}の助言だけ`
    case "all":
      return "すべて並べる"
    case "none":
      return "朱書きなし"
    default:
      return "（扱いが不明）"
  }
}
