"use client"

import { MessageSquareWarning } from "lucide-react"

import type { RubricItemRow } from "@/queries/rubric"

import type { DecidedAdviceCombination } from "./hooks/useRubricAdviceChoice"
import { adviceRuleLabel } from "./utils/rubricAdviceOptions"
import type { UndecidedAdviceCombination } from "./utils/rubricAdviceText"
import { rubricItemName } from "./utils/rubricEffectLabel"

interface RubricAdviceSectionProps {
  rubricItems: readonly RubricItemRow[]
  undecided: readonly UndecidedAdviceCombination[]
  decided: readonly DecidedAdviceCombination[]
  /** 未決定の組み合わせに振っている番号（項目の続き。場面の外なら null） */
  numberOfUndecided: (undecidedIndex: number) => number | null
  /** 選択の場面の焦点がある未決定の組み合わせ（無ければ null） */
  focusedUndecidedIndex: number | null
  onOpen: (itemIds: readonly string[]) => void
}

/**
 * 左のパネルの「重なった助言」（docs/vlm-grading-design.md §4-7）。助言のある項目が2つ以上
 * 当たった答案の組み合わせのうち、決まりの無いもの（未決定）と、決めたものを並べる。
 * 押すと、その組み合わせの問いかけを開く
 */
export function RubricAdviceSection({
  rubricItems,
  undecided,
  decided,
  numberOfUndecided,
  focusedUndecidedIndex,
  onOpen,
}: RubricAdviceSectionProps) {
  if (undecided.length === 0 && decided.length === 0) return null
  const nameOf = (rubricItemId: string) => {
    const rubricItem = rubricItems.find(
      (listedItem) => listedItem.id === rubricItemId
    )
    return rubricItem ? `「${rubricItemName(rubricItem)}」` : "（消えた項目）"
  }
  const namesOf = (itemIds: readonly string[]) => itemIds.map(nameOf).join("＋")

  return (
    <section className="border-t px-2 py-2" aria-label="重なった助言">
      <h3 className="flex items-center gap-1 px-1 text-[11px] font-medium text-gray-600">
        <MessageSquareWarning className="h-3 w-3" />
        重なった助言
      </h3>
      <ol className="mt-1 space-y-1">
        {undecided.map((combination, undecidedIndex) => {
          const choiceNumber = numberOfUndecided(undecidedIndex)
          return (
            <li key={combination.itemIds.join("+")}>
              <button
                type="button"
                className={`flex w-full items-start gap-1.5 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-left text-xs ${
                  focusedUndecidedIndex === undecidedIndex
                    ? "ring-2 ring-amber-400"
                    : ""
                }`}
                onClick={() => onOpen(combination.itemIds)}
              >
                <span
                  className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] font-semibold ${
                    choiceNumber !== null
                      ? "bg-amber-100 text-amber-800"
                      : "text-transparent"
                  }`}
                >
                  {choiceNumber ?? "·"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-gray-800">
                    {namesOf(combination.itemIds)}
                  </span>
                  <span className="block text-[11px] text-amber-800">
                    未決定・{combination.examStudentIds.length}
                    件（朱書きは決めるまで入りません）
                  </span>
                </span>
              </button>
            </li>
          )
        })}
        {decided.map((combination) => (
          <li key={combination.rule.id}>
            <button
              type="button"
              className="flex w-full flex-col rounded border border-gray-200 bg-white px-2 py-1.5 pl-7 text-left text-xs"
              onClick={() => onOpen(combination.itemIds)}
            >
              <span className="text-gray-800">
                {namesOf(combination.itemIds)}
              </span>
              <span className="text-[11px] text-gray-500">
                {adviceRuleLabel(combination.rule, nameOf)}・
                {combination.examStudentIds.length}件
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}
