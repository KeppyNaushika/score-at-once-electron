/**
 * 解答用紙の編集状態（useReducer + undo/redo）と、編集の意図の組み立て。
 *
 * **対象は id で指す。** 添字で指すと、その添字が「どの行を書くか」の決定に使われる。
 * 新しい実体はここ（呼び出し側）で作って action に載せる。reducer の中で作ると、
 * 作った id を呼び出し側が知れず、対応する書き込みを組み立てられない。
 *
 * **画面は属性の一部を触り、action は属性ひとそろいを運ぶ。** 「配点だけ」「余白だけ」と
 * いう触り方と、「その行の列を書く」という書き込みの単位は別のものなので、足りない分を
 * 今の状態から埋めるのはここが受け持つ。
 *
 * **書き込み（DB への保存）はここではしない。** 編集が起きたことを `onEdit` で伝え、
 * 実際に書くのは編集画面（`AnswerSheetBuilderMainView`）。フックは DB を触らない
 * （docs/coding-style.md「フックはデータを受け取る。取らない・書かない」）。
 *
 * 設問の意図は `definition/useQuestionEditActions.ts`、セルの中身の意図は
 * `definition/useCellContentEditActions.ts`、reducer は `definition/definitionReducer.ts`。
 */

import { useCallback, useEffect, useMemo, useRef } from "react"

import type {
  AnswerSheetDefinition,
  AnswerSheetEditAction,
  AsbCellParent,
  AsbDefinitionUpdate,
  AsbHeaderFieldAttributes,
  HeaderFieldDefinition,
  LabelCategory,
} from "@/types/answerSheetDefinition.types"

import {
  createDefaultDefinition,
  createDefaultHeaderField,
  parsePresetLabels,
} from "../constants"
import type { AsbEditorActions } from "../types"
import { findCell } from "./definition/definitionLookup"
import { definitionReducer } from "./definition/definitionReducer"
import {
  definitionAttributes,
  headerFieldAttributes,
} from "./definition/entityAttributes"
import { labelAssignments } from "./definition/questionLabels"
import { useCellContentEditActions } from "./definition/useCellContentEditActions"
import { useQuestionEditActions } from "./definition/useQuestionEditActions"
import { useUndoableReducer } from "./useUndoableReducer"

interface UseAnswerSheetDefinitionOptions {
  /** 最初に置く内容（読み込み前は既定の解答用紙） */
  initial?: AnswerSheetDefinition
  /**
   * 編集が1つ起きた。**ここで DB へ書く。**
   *
   * 呼ばれるのは実際に意図のある編集だけで、読み込み（`setDefinition`）では呼ばない。
   */
  onEdit: (action: AnswerSheetEditAction) => void
  /**
   * 過去（または先）の姿へ戻した。
   *
   * undo / redo は「文書全体の過去の姿」を復元する操作で、対応する1つの意図が無い。
   * 丸ごと置き換える経路へ流す。
   */
  onRestore: (definition: AnswerSheetDefinition) => void
}

/** 解答用紙の編集操作と Undo/Redo を提供するフック */
export function useAnswerSheetDefinition({
  initial,
  onEdit,
  onRestore,
}: UseAnswerSheetDefinitionOptions) {
  const {
    state: definition,
    dispatch,
    previousState,
    nextState,
    undo: undoState,
    redo: redoState,
  } = useUndoableReducer(
    definitionReducer,
    initial ?? createDefaultDefinition()
  )

  /**
   * いまの編集内容と、書き込み先。
   *
   * 編集の操作（`actions`）は「配点だけ」といった一部の指定を受け取り、足りない属性を
   * 今の内容から埋める。それを引数や依存に置くと**編集のたびに全部の操作が別物になり**、
   * フォームが丸ごと描き直される。最新の値は ref から読み、操作そのものは固定する。
   */
  const definitionRef = useRef(definition)
  const onEditRef = useRef(onEdit)
  const onRestoreRef = useRef(onRestore)
  useEffect(() => {
    definitionRef.current = definition
    onEditRef.current = onEdit
    onRestoreRef.current = onRestore
  })

  /** 編集を状態へ当て、同じ意図を書き込みへ渡す（**書き込みの関所**） */
  const edit = useCallback(
    (action: AnswerSheetEditAction) => {
      dispatch(action)
      onEditRef.current(action)
    },
    [dispatch]
  )

  const setDefinition = useCallback(
    (next: AnswerSheetDefinition) =>
      dispatch({ type: "SET_DEFINITION", payload: next }),
    [dispatch]
  )

  const undo = useCallback(() => {
    if (!previousState) return
    undoState()
    onRestoreRef.current(previousState)
  }, [previousState, undoState])

  const redo = useCallback(() => {
    if (!nextState) return
    redoState()
    onRestoreRef.current(nextState)
  }, [nextState, redoState])

  const updateDefinition = useCallback(
    (data: AsbDefinitionUpdate) => {
      const current = definitionAttributes(definitionRef.current)
      edit({
        type: "UPDATE_DEFINITION",
        payload: {
          attributes: {
            ...current,
            ...data,
            settings: { ...current.settings, ...data.settings },
          },
        },
      })
    },
    [edit]
  )

  const applyLabelPreset = useCallback(
    (category: LabelCategory, preset: string) => {
      const labels = parsePresetLabels(preset)
      const relabeled = labelAssignments(
        definitionRef.current,
        category,
        labels
      )
      edit({
        type: "APPLY_LABEL_PRESET",
        payload: { category, preset, relabeled },
      })
    },
    [edit]
  )

  // ---------- ヘッダー項目 ----------

  const addHeaderField = useCallback(
    (defaults?: Partial<HeaderFieldDefinition>) =>
      edit({
        type: "ADD_HEADER_FIELD",
        payload: {
          headerField: createDefaultHeaderField({
            ...defaults,
            order: definitionRef.current.settings.headerFields.length,
          }),
        },
      }),
    [edit]
  )

  const updateHeaderField = useCallback(
    (headerFieldId: string, data: Partial<AsbHeaderFieldAttributes>) => {
      const headerField = definitionRef.current.settings.headerFields.find(
        (candidate) => candidate.id === headerFieldId
      )
      if (!headerField) return
      edit({
        type: "UPDATE_HEADER_FIELD",
        payload: {
          headerFieldId,
          attributes: { ...headerFieldAttributes(headerField), ...data },
        },
      })
    },
    [edit]
  )

  const deleteHeaderField = useCallback(
    (headerFieldId: string) =>
      edit({ type: "DELETE_HEADER_FIELD", payload: { headerFieldId } }),
    [edit]
  )

  const reorderHeaderFields = useCallback(
    (orderedIds: string[]) =>
      edit({ type: "REORDER_HEADER_FIELDS", payload: { orderedIds } }),
    [edit]
  )

  // ---------- 設問・セルの中身 ----------

  const questionActions = useQuestionEditActions({ definitionRef, edit })
  const cellContentActions = useCellContentEditActions({
    definitionRef,
    edit,
  })

  /**
   * main が書いた原稿用紙の行の id を木へ取り込む。**書き込みは起こさない**。
   *
   * 原稿用紙が木に無いセルでは新しい id を振って渡すが、DB に行が在れば main は
   * その行を更新し、渡した id は捨てられる（別の端末が先に作ったとき）。
   * 取り込まないと、木の原稿用紙は存在しない行を指したままになり、
   * 文字位置マーカーの追加が外部キーで、全体保存が親の `@unique` で落ちる。
   */
  const adoptManuscriptPaperId = useCallback(
    (parent: AsbCellParent, manuscriptPaperId: string) => {
      const cell = findCell(definitionRef.current, parent)
      if (!cell?.manuscriptPaper) return
      if (cell.manuscriptPaper.id === manuscriptPaperId) return
      dispatch({
        type: "ADOPT_MANUSCRIPT_PAPER_ID",
        payload: { parent, manuscriptPaperId },
      })
    },
    [dispatch]
  )

  const actions = useMemo<AsbEditorActions>(
    () => ({
      updateDefinition,
      applyLabelPreset,
      addHeaderField,
      updateHeaderField,
      deleteHeaderField,
      reorderHeaderFields,
      ...questionActions,
      ...cellContentActions,
    }),
    [
      updateDefinition,
      applyLabelPreset,
      addHeaderField,
      updateHeaderField,
      deleteHeaderField,
      reorderHeaderFields,
      questionActions,
      cellContentActions,
    ]
  )

  return {
    definition,
    /** 編集の操作ひとそろい（フォームへまとめて配る） */
    actions,
    setDefinition,
    /**
     * 書いた結果を木へ取り込む（`actions` には入れない — 編集の意図ではないので、
     * フォームから呼ぶものではない）。
     */
    adoptManuscriptPaperId,
    canUndo: previousState !== undefined,
    canRedo: nextState !== undefined,
    undo,
    redo,
  }
}
