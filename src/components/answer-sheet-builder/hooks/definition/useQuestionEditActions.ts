/**
 * 設問（大問・小問・枝問）の編集の意図を組み立てる。
 *
 * 新しい設問はここで作って action に載せ、更新は足りない属性をいまの姿から埋めて
 * 属性ひとそろいにする。状態へ当てて書き込みへ渡すのは受け取った `edit`。
 */

import type { RefObject } from "react"
import { useCallback, useMemo } from "react"

import type {
  AnswerSheetDefinition,
  AnswerSheetEditAction,
  AsbBranchQuestionAttributes,
  AsbMajorQuestionAttributes,
  AsbSubQuestionUpdate,
} from "@/types/answerSheetDefinition.types"

import {
  createDefaultBranchQuestion,
  createDefaultMajorQuestion,
  createDefaultSubQuestion,
  getCircledNumber,
} from "../../constants"
import type { AsbEditorActions } from "../../types"
import { findBranchQuestion, findSubQuestion } from "./definitionLookup"
import {
  branchQuestionAttributes,
  majorQuestionAttributes,
  subQuestionAttributes,
} from "./entityAttributes"
import { conflictingNeighbour } from "./placementConflict"
import { DEFAULT_BRANCH_LABELS, presetLabel } from "./questionLabels"

type QuestionEditActions = Pick<
  AsbEditorActions,
  | "addMajorQuestion"
  | "updateMajorQuestion"
  | "deleteMajorQuestion"
  | "reorderMajorQuestions"
  | "addSubQuestion"
  | "updateSubQuestion"
  | "deleteSubQuestion"
  | "reorderSubQuestions"
  | "addBranchQuestion"
  | "updateBranchQuestion"
  | "deleteBranchQuestion"
  | "reorderBranchQuestions"
>

interface UseQuestionEditActionsOptions {
  /** いまの編集内容（最新の値を読むだけ。依存に置くと操作が毎回別物になる） */
  definitionRef: RefObject<AnswerSheetDefinition>
  /** 編集を状態へ当て、同じ意図を書き込みへ渡す */
  edit: (action: AnswerSheetEditAction) => void
}

/** 大問・小問・枝問の追加・更新・削除・並べ替え */
export function useQuestionEditActions({
  definitionRef,
  edit,
}: UseQuestionEditActionsOptions): QuestionEditActions {
  // ---------- 大問 ----------

  const addMajorQuestion = useCallback(() => {
    const { majorQuestions, labelPresets } = definitionRef.current
    const index = majorQuestions.length
    edit({
      type: "ADD_MAJOR_QUESTION",
      payload: {
        majorQuestion: createDefaultMajorQuestion(
          presetLabel(labelPresets?.major, index, String(index + 1)),
          presetLabel(labelPresets?.sub, 0, getCircledNumber(1))
        ),
      },
    })
  }, [definitionRef, edit])

  const updateMajorQuestion = useCallback(
    (majorQuestionId: string, data: Partial<AsbMajorQuestionAttributes>) => {
      const majorQuestion = definitionRef.current.majorQuestions.find(
        (candidate) => candidate.id === majorQuestionId
      )
      if (!majorQuestion) return
      edit({
        type: "UPDATE_MAJOR_QUESTION",
        payload: {
          majorQuestionId,
          attributes: { ...majorQuestionAttributes(majorQuestion), ...data },
        },
      })
    },
    [definitionRef, edit]
  )

  const deleteMajorQuestion = useCallback(
    (majorQuestionId: string) =>
      edit({ type: "DELETE_MAJOR_QUESTION", payload: { majorQuestionId } }),
    [edit]
  )

  const reorderMajorQuestions = useCallback(
    (orderedIds: string[]) =>
      edit({ type: "REORDER_MAJOR_QUESTIONS", payload: { orderedIds } }),
    [edit]
  )

  // ---------- 小問 ----------

  const addSubQuestion = useCallback(
    (majorQuestionId: string) => {
      const { majorQuestions, labelPresets } = definitionRef.current
      const majorQuestion = majorQuestions.find(
        (candidate) => candidate.id === majorQuestionId
      )
      if (!majorQuestion) return
      const index = majorQuestion.subQuestions.length
      edit({
        type: "ADD_SUB_QUESTION",
        payload: {
          majorQuestionId,
          subQuestion: createDefaultSubQuestion(
            presetLabel(labelPresets?.sub, index, getCircledNumber(index + 1))
          ),
        },
      })
    },
    [definitionRef, edit]
  )

  const updateSubQuestion = useCallback(
    (subQuestionId: string, data: AsbSubQuestionUpdate) => {
      const found = findSubQuestion(definitionRef.current, subQuestionId)
      if (!found) return
      const neighbour = conflictingNeighbour(found.siblings, found.index, data)
      if (neighbour) {
        edit({
          type: "UPDATE_SUB_QUESTION",
          payload: {
            subQuestionId: neighbour.question.id,
            attributes: {
              ...subQuestionAttributes(neighbour.question),
              ...neighbour.cleared,
            },
          },
        })
      }
      // 属性はすべて平ら（入れ子は無い）ので1回の重ね合わせで正しく混ざる。
      // 原稿用紙が小問の列だった頃はここだけ1段深く混ぜ直しており、それが
      // 「ラベルを打つと原稿用紙が消える」の正体だった
      edit({
        type: "UPDATE_SUB_QUESTION",
        payload: {
          subQuestionId,
          attributes: { ...subQuestionAttributes(found.question), ...data },
        },
      })
    },
    [definitionRef, edit]
  )

  const deleteSubQuestion = useCallback(
    (subQuestionId: string) =>
      edit({ type: "DELETE_SUB_QUESTION", payload: { subQuestionId } }),
    [edit]
  )

  const reorderSubQuestions = useCallback(
    (majorQuestionId: string, orderedIds: string[]) =>
      edit({
        type: "REORDER_SUB_QUESTIONS",
        payload: { majorQuestionId, orderedIds },
      }),
    [edit]
  )

  // ---------- 枝問 ----------

  const addBranchQuestion = useCallback(
    (subQuestionId: string) => {
      const found = findSubQuestion(definitionRef.current, subQuestionId)
      if (!found) return
      const index = found.question.branchQuestions.length
      edit({
        type: "ADD_BRANCH_QUESTION",
        payload: {
          subQuestionId,
          branchQuestion: createDefaultBranchQuestion(
            presetLabel(
              definitionRef.current.labelPresets?.branch,
              index,
              DEFAULT_BRANCH_LABELS[index] ?? `(${index + 1})`
            )
          ),
        },
      })
    },
    [definitionRef, edit]
  )

  const updateBranchQuestion = useCallback(
    (branchQuestionId: string, data: Partial<AsbBranchQuestionAttributes>) => {
      const found = findBranchQuestion(definitionRef.current, branchQuestionId)
      if (!found) return
      const neighbour = conflictingNeighbour(found.siblings, found.index, data)
      if (neighbour) {
        edit({
          type: "UPDATE_BRANCH_QUESTION",
          payload: {
            branchQuestionId: neighbour.question.id,
            attributes: {
              ...branchQuestionAttributes(neighbour.question),
              ...neighbour.cleared,
            },
          },
        })
      }
      edit({
        type: "UPDATE_BRANCH_QUESTION",
        payload: {
          branchQuestionId,
          attributes: {
            ...branchQuestionAttributes(found.question),
            ...data,
          },
        },
      })
    },
    [definitionRef, edit]
  )

  const deleteBranchQuestion = useCallback(
    (branchQuestionId: string) =>
      edit({ type: "DELETE_BRANCH_QUESTION", payload: { branchQuestionId } }),
    [edit]
  )

  const reorderBranchQuestions = useCallback(
    (subQuestionId: string, orderedIds: string[]) =>
      edit({
        type: "REORDER_BRANCH_QUESTIONS",
        payload: { subQuestionId, orderedIds },
      }),
    [edit]
  )

  return useMemo(
    () => ({
      addMajorQuestion,
      updateMajorQuestion,
      deleteMajorQuestion,
      reorderMajorQuestions,
      addSubQuestion,
      updateSubQuestion,
      deleteSubQuestion,
      reorderSubQuestions,
      addBranchQuestion,
      updateBranchQuestion,
      deleteBranchQuestion,
      reorderBranchQuestions,
    }),
    [
      addMajorQuestion,
      updateMajorQuestion,
      deleteMajorQuestion,
      reorderMajorQuestions,
      addSubQuestion,
      updateSubQuestion,
      deleteSubQuestion,
      reorderSubQuestions,
      addBranchQuestion,
      updateBranchQuestion,
      deleteBranchQuestion,
      reorderBranchQuestions,
    ]
  )
}
