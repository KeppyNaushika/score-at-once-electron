/**
 * 左のルーブリックのパネルの選択の場面（docs/vlm-grading-design.md §11-4）。
 *
 * 並びは2つある。
 * - **項目の一覧**: 項目（数字で当てる・外す）に続けて、未決定の重なった助言（数字で開く）。
 *   0 で項目の追加、Enter で次の答案、Esc で場面から抜ける
 * - **重なった助言の問いかけ**: 選択肢（数字で選ぶ）。0 でまとめた一文を書く、Enter で決める、
 *   Esc で項目の一覧へ戻る（場面からは抜けない）
 *
 * 場面の仕組みは1つ（`useChoiceScene`）で、開いている並びによって数と動きを切り替える。
 * 焦点の位置は場面が持ち、問いかけの選択肢の焦点（下見に出すもの）もそれを使う。
 */

import { useCallback, useRef } from "react"

import { useChoiceScene } from "@/components/exams/07-score-at-once/hooks/useChoiceScene"
import type { RubricItemRow } from "@/queries/rubric"

import type { useRubricAdviceChoice } from "./useRubricAdviceChoice"

interface UseRubricPanelChoiceSceneOptions {
  rubricItems: readonly RubricItemRow[]
  adviceChoice: ReturnType<typeof useRubricAdviceChoice>
  onToggleItem: (rubricItemId: string) => void
  /** 0（その他）: 項目を追加して当てる */
  onCreateItem: () => void
  /** Enter: 次の答案へ */
  onAdvance: () => void
}

export function useRubricPanelChoiceScene({
  rubricItems,
  adviceChoice,
  onToggleItem,
  onCreateItem,
  onAdvance,
}: UseRubricPanelChoiceSceneOptions) {
  const mergedTextRef = useRef<HTMLTextAreaElement | null>(null)
  /** 問いかけを開く前の、項目の一覧での焦点（戻ったときに戻す） */
  const itemsFocusRef = useRef(0)
  const isChoosingAdvice = adviceChoice.activeCombination !== null
  const mergedIndex = adviceChoice.options.findIndex(
    (option) => option.kind === "merged"
  )

  const focusMergedText = () => mergedTextRef.current?.focus()

  const choiceScene = useChoiceScene({
    entryCount: isChoosingAdvice
      ? adviceChoice.options.length
      : rubricItems.length + adviceChoice.undecided.length,
    onSelect: (entryIndex) => {
      if (isChoosingAdvice) {
        if (entryIndex === mergedIndex) focusMergedText()
        return
      }
      if (entryIndex < rubricItems.length) {
        onToggleItem(rubricItems[entryIndex].id)
        return
      }
      const combination =
        adviceChoice.undecided[entryIndex - rubricItems.length]
      if (combination) openAdvice(combination.itemIds)
    },
    onOther: () => {
      if (isChoosingAdvice) {
        choiceScene.setFocusedIndex(mergedIndex)
        focusMergedText()
        return
      }
      choiceScene.close()
      onCreateItem()
    },
    onConfirm: (focusedIndex) => {
      if (isChoosingAdvice) void decideAdvice(focusedIndex)
      else onAdvance()
    },
    onExit: isChoosingAdvice ? () => closeAdvice() : undefined,
  })
  const { setFocusedIndex } = choiceScene

  /** 重なった助言の問いかけを開き、今の決まりの選択肢に焦点を置く */
  const openAdvice = useCallback(
    (itemIds: readonly string[]) => {
      if (!isChoosingAdvice) itemsFocusRef.current = choiceScene.focusedIndex
      setFocusedIndex(adviceChoice.open(itemIds))
    },
    [isChoosingAdvice, choiceScene.focusedIndex, setFocusedIndex, adviceChoice]
  )

  /** 問いかけを閉じて、項目の一覧の焦点へ戻る */
  const closeAdvice = useCallback(() => {
    adviceChoice.close()
    setFocusedIndex(itemsFocusRef.current)
  }, [adviceChoice, setFocusedIndex])

  /** 選択肢で決める。決まったら項目の一覧へ戻る */
  const decideAdvice = useCallback(
    async (optionIndex: number) => {
      if (await adviceChoice.decide(optionIndex)) {
        setFocusedIndex(itemsFocusRef.current)
      }
    },
    [adviceChoice, setFocusedIndex]
  )

  const isItemsSceneOpen = choiceScene.isOpen && !isChoosingAdvice
  return {
    choiceScene,
    isChoosingAdvice,
    mergedTextRef,
    openAdvice,
    closeAdvice,
    decideAdvice,
    /** 項目の一覧で、項目に振っている番号 */
    numberOfItem: (itemIndex: number) =>
      isItemsSceneOpen ? choiceScene.numberOf(itemIndex) : null,
    isItemFocused: (itemIndex: number) =>
      isItemsSceneOpen && choiceScene.focusedIndex === itemIndex,
    /** 項目の一覧で、未決定の重なった助言に振っている番号（項目の続き） */
    numberOfUndecided: (undecidedIndex: number) =>
      isItemsSceneOpen
        ? choiceScene.numberOf(rubricItems.length + undecidedIndex)
        : null,
    focusedUndecidedIndex:
      isItemsSceneOpen && choiceScene.focusedIndex >= rubricItems.length
        ? choiceScene.focusedIndex - rubricItems.length
        : null,
  }
}
