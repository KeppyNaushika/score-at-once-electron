"use client"

import { ArrowLeft, Check, RotateCcw } from "lucide-react"
import type { ComponentProps, RefObject } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type { RubricItemRow } from "@/queries/rubric"

import type { ActiveAdviceCombination } from "./hooks/useRubricAdviceChoice"
import { RubricAdvicePreview } from "./RubricAdvicePreview"
import {
  type AdviceOption,
  toAdviceChoiceOfOption,
} from "./utils/rubricAdviceOptions"
import { adviceTextOfChoice } from "./utils/rubricAdviceText"
import { rubricItemName } from "./utils/rubricEffectLabel"

interface RubricAdviceChoiceViewProps {
  rubricItems: readonly RubricItemRow[]
  activeCombination: ActiveAdviceCombination
  options: readonly AdviceOption[]
  /** 焦点のある選択肢（下見に出すもの） */
  focusedIndex: number
  /** 選択の場面で振っている番号（場面の外なら null） */
  numberOf: (optionIndex: number) => number | null
  isChoiceSceneOpen: boolean
  mergedText: string
  onMergedTextChange: (mergedText: string) => void
  mergedTextRef: RefObject<HTMLTextAreaElement | null>
  onFocusOption: (optionIndex: number) => void
  onDecide: (optionIndex: number) => void
  onBack: () => void
  onClearRule: () => void
  isWriting: boolean
  /** 下見に要るもの（朱書きの文は焦点のある選択肢から求める） */
  preview: Omit<ComponentProps<typeof RubricAdvicePreview>, "adviceText">
}

/**
 * 重なった助言の問いかけ（docs/vlm-grading-design.md §3-7）。左に選択肢、右にその組み合わせの
 * 答案へ朱書きを置いた下見。選択の場面では数字で選び、Enter で決め、Esc で項目の一覧へ戻る
 */
export function RubricAdviceChoiceView({
  rubricItems,
  activeCombination,
  options,
  focusedIndex,
  numberOf,
  isChoiceSceneOpen,
  mergedText,
  onMergedTextChange,
  mergedTextRef,
  onFocusOption,
  onDecide,
  onBack,
  onClearRule,
  isWriting,
  preview,
}: RubricAdviceChoiceViewProps) {
  const itemOf = (rubricItemId: string) =>
    rubricItems.find((rubricItem) => rubricItem.id === rubricItemId)
  const combinationItems = activeCombination.itemIds.flatMap((rubricItemId) => {
    const rubricItem = itemOf(rubricItemId)
    return rubricItem ? [rubricItem] : []
  })
  const focusedOption = options[focusedIndex]
  const previewText = focusedOption
    ? adviceTextOfChoice(
        toAdviceChoiceOfOption(focusedOption, mergedText),
        activeCombination.itemIds,
        rubricItems
      )
    : null
  const mergedIndex = options.findIndex((option) => option.kind === "merged")

  const optionLabel = (option: AdviceOption) => {
    switch (option.kind) {
      case "merged":
        return "まとめた一文"
      case "single": {
        const rubricItem = itemOf(option.rubricItemId)
        return `「${rubricItem ? rubricItemName(rubricItem) : "（消えた項目）"}」の助言だけ`
      }
      case "all":
        return "すべて並べる"
      case "none":
        return "朱書きなし"
    }
  }
  const optionDetail = (option: AdviceOption) =>
    option.kind === "single"
      ? (itemOf(option.rubricItemId)?.adviceText ?? "")
      : ""

  return (
    <div className="flex min-h-0 flex-1" aria-label="重なった助言の決まり">
      <div className="flex w-72 shrink-0 flex-col border-r">
        <div className="border-b px-3 py-2">
          <p className="text-xs font-medium text-gray-800">
            {combinationItems
              .map((rubricItem) => `「${rubricItemName(rubricItem)}」`)
              .join("＋")}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-500">
            {activeCombination.rule ? "決めた扱いを変えます" : "未決定"}・
            {isChoiceSceneOpen
              ? "数字で選ぶ／0 で一文を書く／Enter で決める／Esc で戻る"
              : "朱書きの扱いを選んで決めます"}
          </p>
        </div>
        <ol className="flex-1 space-y-1 overflow-y-auto p-2">
          {options.map((option, optionIndex) => {
            const choiceNumber = isChoiceSceneOpen
              ? numberOf(optionIndex)
              : null
            const isFocused = optionIndex === focusedIndex
            return (
              <li
                key={
                  option.kind === "single" ? option.rubricItemId : option.kind
                }
                className={`rounded border px-2 py-1.5 text-xs ${
                  isFocused
                    ? "border-amber-400 bg-amber-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <button
                  type="button"
                  className="flex w-full items-start gap-1.5 text-left"
                  aria-pressed={isFocused}
                  onClick={() => {
                    onFocusOption(optionIndex)
                    if (option.kind === "merged") mergedTextRef.current?.focus()
                  }}
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
                    <span className="block font-medium text-gray-800">
                      {optionLabel(option)}
                    </span>
                    {optionDetail(option) && (
                      <span className="block text-[11px] text-red-700">
                        {optionDetail(option)}
                      </span>
                    )}
                  </span>
                </button>
                {option.kind === "merged" && (
                  <Textarea
                    ref={mergedTextRef}
                    aria-label="まとめた一文"
                    className="mt-1 min-h-14 text-xs"
                    placeholder="例: 移項の符号と単位を見直そう"
                    value={mergedText}
                    onFocus={() => onFocusOption(optionIndex)}
                    onChange={(event) => onMergedTextChange(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault()
                        onDecide(mergedIndex)
                      }
                      if (event.key === "Escape") event.currentTarget.blur()
                    }}
                  />
                )}
              </li>
            )
          })}
        </ol>
        <div className="flex flex-wrap gap-1 border-t p-2">
          <Button
            size="sm"
            className="flex-1"
            disabled={isWriting}
            onClick={() => onDecide(focusedIndex)}
          >
            <Check className="h-4 w-4" />
            決める
          </Button>
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            戻る
          </Button>
          {activeCombination.rule && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-[11px]"
              disabled={isWriting}
              onClick={onClearRule}
            >
              <RotateCcw className="h-3 w-3" />
              未決定に戻す（朱書きを外す）
            </Button>
          )}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <RubricAdvicePreview {...preview} adviceText={previewText} />
      </div>
    </div>
  )
}
