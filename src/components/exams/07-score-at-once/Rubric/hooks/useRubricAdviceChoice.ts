/**
 * 重なった助言の決まりを、左のパネルで問いかけて決める（docs/vlm-grading-design.md §3-7・§4-7）。
 *
 * 助言のある項目が1枚の答案に2つ以上当たり、その項目の集合の決まりが無ければ「未決定」として
 * パネルに出す。開くと選択肢（まとめた一文・○○の助言だけ・すべて並べる・朱書きなし）が並び、
 * 選んで決めると決まりを保存し、その集合の答案の朱書きを作り直す。決めた決まりも開き直して
 * 変えられ、未決定に戻せる。
 *
 * 何を開いているか（`activeCombination`）とまとめた一文の下書きだけをここが持つ。
 * どの選択肢に焦点があるかは選択の場面（`useChoiceScene`）の焦点を使う。
 */

import { useMutation, useQuery } from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

import {
  deleteRubricAdviceCombinationMutation,
  type RubricAdviceCombinationRow,
  rubricAdviceCombinationsQuery,
  type RubricItemRow,
  saveRubricAdviceCombinationMutation,
} from "@/queries/rubric"

import {
  type AdviceOption,
  listAdviceOptions,
  optionIndexOfRule,
  toAdviceChoiceOfOption,
} from "../utils/rubricAdviceOptions"
import {
  adviceItemIdsOf,
  findAdviceCombination,
  findUndecidedAdviceCombinations,
  isSameItemSet,
} from "../utils/rubricAdviceText"
import type { useRubricAdviceSync } from "./useRubricAdviceSync"

/** まだ届いていない決まりの空の並び（毎回作り直さない） */
const NO_COMBINATIONS: RubricAdviceCombinationRow[] = []

/** 開いている組み合わせ */
export interface ActiveAdviceCombination {
  /** 組み合わせを作る項目（項目の並び順） */
  itemIds: string[]
  /** 今の決まり（未決定なら null） */
  rule: RubricAdviceCombinationRow | null
}

/** 決めた決まり1つと、その集合の自分の答案 */
export interface DecidedAdviceCombination {
  rule: RubricAdviceCombinationRow
  /** 組み合わせを作る項目（項目の並び順。もう無い項目は落とす） */
  itemIds: string[]
  examStudentIds: string[]
}

interface UseRubricAdviceChoiceOptions {
  examId: string
  cropRegionId: string
  rubricItems: readonly RubricItemRow[]
  /** 自分の採点行がある答案の、当たっている項目 */
  ownAppliedCells: readonly {
    examStudentId: string
    appliedItemIds: ReadonlySet<string>
  }[]
  syncRowsWithAdviceSet: ReturnType<
    typeof useRubricAdviceSync
  >["syncRowsWithAdviceSet"]
}

export function useRubricAdviceChoice({
  examId,
  cropRegionId,
  rubricItems,
  ownAppliedCells,
  syncRowsWithAdviceSet,
}: UseRubricAdviceChoiceOptions) {
  const { data: combinations = NO_COMBINATIONS } = useQuery(
    rubricAdviceCombinationsQuery(examId, cropRegionId)
  )
  const { mutateAsync: saveCombination, isPending: isSaving } = useMutation(
    saveRubricAdviceCombinationMutation(examId, cropRegionId)
  )
  const { mutateAsync: deleteCombination, isPending: isDeleting } = useMutation(
    deleteRubricAdviceCombinationMutation(examId, cropRegionId)
  )

  const undecided = useMemo(
    () =>
      findUndecidedAdviceCombinations(
        ownAppliedCells,
        rubricItems,
        combinations
      ),
    [ownAppliedCells, rubricItems, combinations]
  )

  /** 自分の答案のうち、助言のある項目の集合がその組み合わせと同じもの */
  const examStudentIdsOfSet = useCallback(
    (itemIds: readonly string[]) =>
      ownAppliedCells
        .filter((cell) =>
          isSameItemSet(
            adviceItemIdsOf(cell.appliedItemIds, rubricItems),
            itemIds
          )
        )
        .map((cell) => cell.examStudentId),
    [ownAppliedCells, rubricItems]
  )

  const decided = useMemo<DecidedAdviceCombination[]>(
    () =>
      combinations.flatMap((rule) => {
        const ruleItemIds = rule.items.map((item) => item.rubricItemId)
        const itemIds = rubricItems
          .filter((rubricItem) => ruleItemIds.includes(rubricItem.id))
          .map((rubricItem) => rubricItem.id)
        // 同期で同じ集合が重なったときは、効いている（新しい）ものだけを出す
        if (itemIds.length < 2) return []
        if (findAdviceCombination(ruleItemIds, combinations)?.id !== rule.id) {
          return []
        }
        return [{ rule, itemIds, examStudentIds: examStudentIdsOfSet(itemIds) }]
      }),
    [combinations, rubricItems, examStudentIdsOfSet]
  )

  const [activeCombination, setActiveCombination] =
    useState<ActiveAdviceCombination | null>(null)
  const [mergedText, setMergedText] = useState("")

  const options = useMemo<AdviceOption[]>(
    () =>
      activeCombination ? listAdviceOptions(activeCombination.itemIds) : [],
    [activeCombination]
  )

  /** 開いている組み合わせの、自分の答案 */
  const activeExamStudentIds = useMemo(
    () =>
      activeCombination ? examStudentIdsOfSet(activeCombination.itemIds) : [],
    [activeCombination, examStudentIdsOfSet]
  )

  /** 組み合わせを開く。焦点を置く選択肢の位置を返す（今の決まりの選択肢） */
  const open = useCallback(
    (itemIds: readonly string[]): number => {
      const rule = findAdviceCombination(itemIds, combinations)
      setActiveCombination({ itemIds: [...itemIds], rule })
      setMergedText(rule?.mode === "merged" ? rule.mergedText : "")
      return optionIndexOfRule(listAdviceOptions(itemIds), rule)
    },
    [combinations]
  )

  const close = useCallback(() => setActiveCombination(null), [])

  /**
   * 選択肢で決める。決まりを保存し、その集合の答案の朱書きを作り直して閉じる。
   * まとめた一文が空なら決めない（false）
   */
  const decide = useCallback(
    async (optionIndex: number): Promise<boolean> => {
      const option = options[optionIndex]
      if (!activeCombination || !option) return false
      const choice = toAdviceChoiceOfOption(option, mergedText.trim())
      if (choice.mode === "merged" && choice.mergedText === "") {
        toast.info("まとめた一文を書いてください")
        return false
      }
      try {
        await saveCombination({
          cropRegionId,
          rubricItemIds: activeCombination.itemIds,
          mode: choice.mode,
          mergedText: choice.mode === "merged" ? choice.mergedText : "",
          primaryRubricItemId:
            choice.mode === "single" ? choice.primaryRubricItemId : null,
        })
      } catch {
        // 失敗の通知は MutationCache の後始末が担う
        return false
      }
      setActiveCombination(null)
      await syncRowsWithAdviceSet(activeCombination.itemIds)
      return true
    },
    [
      options,
      activeCombination,
      mergedText,
      saveCombination,
      cropRegionId,
      syncRowsWithAdviceSet,
    ]
  )

  /** 開いている組み合わせの決まりを消し（未決定に戻し）、その集合の答案の朱書きを外す */
  const clearRule = useCallback(async () => {
    if (!activeCombination?.rule) return
    try {
      await deleteCombination(activeCombination.rule.id)
    } catch {
      return
    }
    setActiveCombination(null)
    await syncRowsWithAdviceSet(activeCombination.itemIds)
  }, [activeCombination, deleteCombination, syncRowsWithAdviceSet])

  return {
    undecided,
    decided,
    activeCombination,
    activeExamStudentIds,
    options,
    mergedText,
    setMergedText,
    open,
    close,
    decide,
    clearRule,
    isWriting: isSaving || isDeleting,
  }
}
