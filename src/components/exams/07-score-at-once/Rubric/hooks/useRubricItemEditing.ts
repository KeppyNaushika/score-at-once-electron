/**
 * ルーブリック項目の追加・変更・削除・並べ替え（docs/vlm-grading-design.md §4-2・§4-6）。
 *
 * 効き方は保存の前に `validateRubricItemEffect`（main が書く前に通すものと同じ規則）で
 * 確かめ、通らなければトーストで知らせて書かない。変更・削除・並べ替えは、点の変わる
 * 行を洗い出してから書く（`useRubricRecalculation`）。
 *
 * 助言の文の変更・削除・並べ替えのあとは、項目の助言から作る朱書きも合わせる（§4-7）。
 */

import { useMutation } from "@tanstack/react-query"
import { useCallback } from "react"
import { toast } from "sonner"

import {
  type RubricItemEffect,
  type ValidatedRubricItemEffect,
  validateRubricItemEffect,
} from "@/lib/shared/rubric/rubricItemValidator"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"
import {
  createRubricItemMutation,
  deleteRubricItemMutation,
  type RubricItemRow,
  updateRubricItemMutation,
} from "@/queries/rubric"

import {
  withEditedRubricItem,
  withoutRubricItem,
} from "../utils/rubricRecalculation"
import type { useRubricAdviceSync } from "./useRubricAdviceSync"
import type { useRubricRecalculation } from "./useRubricRecalculation"

/** 編集画面で書く項目の中身 */
export interface RubricItemDraft extends RubricItemEffect {
  label: string
  adviceText: string
}

/** 項目の名前（判断理由が空なら効き方で呼ぶ） */
const itemName = (rubricItem: Pick<RubricItemRow, "label">) =>
  rubricItem.label ? `「${rubricItem.label}」` : ""

interface UseRubricItemEditingOptions {
  examId: string
  cropRegion: QuestionAnswerRegionRow
  rubricItems: readonly RubricItemRow[]
  runWithRecalculation: ReturnType<
    typeof useRubricRecalculation
  >["runWithRecalculation"]
  adviceSync: Pick<
    ReturnType<typeof useRubricAdviceSync>,
    | "syncRowsWithItem"
    | "syncRows"
    | "syncRowsWithCombinedAdvice"
    | "readRowIdsWithItem"
  >
}

export function useRubricItemEditing({
  examId,
  cropRegion,
  rubricItems,
  runWithRecalculation,
  adviceSync,
}: UseRubricItemEditingOptions) {
  const { mutateAsync: createItem } = useMutation(
    createRubricItemMutation(examId, cropRegion.id)
  )
  const { mutateAsync: updateItem } = useMutation(
    updateRubricItemMutation(examId, cropRegion.id)
  )
  const { mutateAsync: deleteItem } = useMutation(
    deleteRubricItemMutation(examId, cropRegion.id)
  )

  /** 効き方を確かめる。通らなければトーストで知らせて null */
  const validate = useCallback(
    (draft: RubricItemDraft): ValidatedRubricItemEffect | null => {
      const validation = validateRubricItemEffect(draft, cropRegion.points)
      if (validation.ok) return validation.value
      toast.error(validation.reasons.join("・"))
      return null
    },
    [cropRegion.points]
  )

  /** 項目を作る（並びの最後へ）。作れたら作った項目を返す */
  const create = useCallback(
    async (draft: RubricItemDraft): Promise<RubricItemRow | null> => {
      const effect = validate(draft)
      if (!effect) return null
      const lastSortOrder = rubricItems.reduce(
        (acc, rubricItem) => Math.max(acc, rubricItem.sortOrder),
        -1
      )
      try {
        return await createItem({
          cropRegionId: cropRegion.id,
          label: draft.label,
          adviceText: draft.adviceText,
          sortOrder: lastSortOrder + 1,
          ...effect,
        })
      } catch {
        // 失敗の通知は MutationCache の後始末が担う
        return null
      }
    },
    [validate, rubricItems, createItem, cropRegion.id]
  )

  /** 項目を直す。他の採点者の点が変わるなら確認する。確かめを通れば true */
  const update = useCallback(
    async (rubricItem: RubricItemRow, draft: RubricItemDraft) => {
      const effect = validate(draft)
      if (!effect) return false
      await runWithRecalculation({
        transform: (source) => {
          const original = source.rubricItems.find(
            (sourceItem) => sourceItem.id === rubricItem.id
          )
          return original
            ? {
                ...source,
                rubricItems: withEditedRubricItem(source.rubricItems, {
                  ...original,
                  ...effect,
                }),
              }
            : source
        },
        options: { onlyRubricItemId: rubricItem.id },
        title: "項目を変更しますか",
        description: `項目${itemName(rubricItem)}は採点者の間で共有しています。`,
        confirmLabel: "変更する",
        change: async () => {
          await updateItem({
            rubricItemId: rubricItem.id,
            data: {
              label: draft.label,
              adviceText: draft.adviceText,
              effect,
            },
          })
          // 助言の文が変わったときだけ合わせる（教員が直した朱書きの文を、関係の無い変更で巻き戻さない）
          if (draft.adviceText.trim() !== rubricItem.adviceText.trim()) {
            await adviceSync.syncRowsWithItem(rubricItem.id)
          }
        },
      })
      return true
    },
    [validate, runWithRecalculation, updateItem, adviceSync]
  )

  /** 項目を消す。当たっている答案の件数を示して、いつも確認する */
  const remove = useCallback(
    (rubricItem: RubricItemRow) =>
      runWithRecalculation({
        transform: (source) => ({
          ...source,
          rubricItems: withoutRubricItem(source.rubricItems, rubricItem.id),
        }),
        options: { onlyRubricItemId: rubricItem.id },
        alwaysConfirm: true,
        title: "項目を削除しますか",
        description: `項目${itemName(rubricItem)}を削除し、当てていた答案からも外します。`,
        confirmLabel: "削除する",
        change: async () => {
          // 消すと適用が消えるので、当たっていた行を先に読んでおく
          const questionScoreIds = await adviceSync.readRowIdsWithItem(
            rubricItem.id
          )
          await deleteItem(rubricItem.id)
          await adviceSync.syncRows(questionScoreIds)
        },
      }),
    [runWithRecalculation, deleteItem, adviceSync]
  )

  /**
   * 項目を1つ上か下へ動かす。並び順は判定を決める項目が重なったときの優先順でもあるので、
   * 点の変わる行を洗い出す。並び順は全項目に振り直し、変わった項目だけを書く
   */
  const move = useCallback(
    (rubricItem: RubricItemRow, step: -1 | 1) => {
      const fromIndex = rubricItems.findIndex(
        (listedItem) => listedItem.id === rubricItem.id
      )
      const toIndex = fromIndex + step
      if (fromIndex < 0 || toIndex < 0 || toIndex >= rubricItems.length) {
        return Promise.resolve()
      }
      const reordered = [...rubricItems]
      reordered.splice(fromIndex, 1)
      reordered.splice(toIndex, 0, rubricItem)
      const sortOrderById = new Map(
        reordered.map((listedItem, index) => [listedItem.id, index])
      )
      const movedItems = reordered.filter(
        (listedItem) =>
          listedItem.sortOrder !== sortOrderById.get(listedItem.id)
      )
      return runWithRecalculation({
        transform: (source) => ({
          ...source,
          rubricItems: source.rubricItems.map((sourceItem) => ({
            ...sourceItem,
            sortOrder: sortOrderById.get(sourceItem.id) ?? sourceItem.sortOrder,
          })),
        }),
        title: "項目の並びを変えますか",
        description:
          "判定を決める項目が重なった答案では、並びが先の項目を採ります。",
        confirmLabel: "並びを変える",
        change: async () => {
          for (const movedItem of movedItems) {
            await updateItem({
              rubricItemId: movedItem.id,
              data: { sortOrder: sortOrderById.get(movedItem.id) },
            })
          }
          // 並べる助言の順が変わる
          await adviceSync.syncRowsWithCombinedAdvice()
        },
      })
    },
    [rubricItems, runWithRecalculation, updateItem, adviceSync]
  )

  return { create, update, remove, move }
}
