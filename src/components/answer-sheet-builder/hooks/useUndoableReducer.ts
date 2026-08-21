/**
 * useReducerをラップするundo/redo対応の汎用フック
 *
 * past/present/futureスタックで状態履歴を管理。
 * テキスト入力連打対策のデバウンスあり。
 */

import { useCallback, useReducer } from "react"

interface UndoableState<S> {
  past: S[]
  present: S
  future: S[]
  /** 直近に履歴へ積んだアクション。連打のデバウンス判定に使う */
  lastAction: { type: string; timestamp: number } | null
}

const MAX_HISTORY = 50
const BATCH_TIME_MS = 300

/**
 * 履歴スキップ対象アクション。
 *
 * `ADOPT_MANUSCRIPT_PAPER_ID` は「書いた行の id を取り込む」だけで、利用者が戻したい
 * 編集ではない。履歴へ積むと、元に戻したときに**捨てられた id を持つ木**が復元され、
 * それが丸ごと保存されて親の `@unique` で落ちる。
 */
const SKIP_HISTORY_ACTIONS = new Set([
  "SET_DEFINITION",
  "UNDO",
  "REDO",
  "ADOPT_MANUSCRIPT_PAPER_ID",
])

interface UndoableResult<S, A> {
  state: S
  dispatch: (action: A) => void
  /**
   * 元に戻したときに現れる状態（履歴が無ければ `undefined`）。
   *
   * 戻せるかどうかだけでなく**戻した先の姿**を外へ出すのは、呼び出し側がそれを
   * 保存しに行くため。undo は「過去の姿へ置き換える」操作で、対応する1つの意図が
   * 無い（docs/asb-ipc-split-plan.md §6.6）。
   */
  previousState: S | undefined
  /** やり直したときに現れる状態（先の履歴が無ければ `undefined`） */
  nextState: S | undefined
  undo: () => void
  redo: () => void
}

/** useReducerにUndo/Redo履歴管理とデバウンスを追加する汎用フック */
export function useUndoableReducer<S, A extends { type: string }>(
  innerReducer: (state: S, action: A) => S,
  initialState: S
): UndoableResult<S, A> {
  function undoableReducer(
    undoState: UndoableState<S>,
    action: A
  ): UndoableState<S> {
    if (action.type === "UNDO") {
      if (undoState.past.length === 0) return undoState
      const previous = undoState.past[undoState.past.length - 1]
      return {
        ...undoState,
        past: undoState.past.slice(0, -1),
        present: previous,
        future: [undoState.present, ...undoState.future],
      }
    }

    if (action.type === "REDO") {
      if (undoState.future.length === 0) return undoState
      const next = undoState.future[0]
      return {
        ...undoState,
        past: [...undoState.past, undoState.present],
        present: next,
        future: undoState.future.slice(1),
      }
    }

    const newPresent = innerReducer(undoState.present, action)

    if (newPresent === undoState.present) {
      return undoState
    }

    // 履歴スキップ対象
    if (SKIP_HISTORY_ACTIONS.has(action.type)) {
      return {
        ...undoState,
        present: newPresent,
      }
    }

    // デバウンス: 同一アクションタイプが短時間内に連続した場合、pastを増やさない
    const now = Date.now()
    const last = undoState.lastAction
    const isBatched =
      last !== null &&
      last.type === action.type &&
      now - last.timestamp < BATCH_TIME_MS
    const lastAction = { type: action.type, timestamp: now }

    if (isBatched) {
      // pastは変えず、presentだけ更新
      return {
        ...undoState,
        present: newPresent,
        future: [],
        lastAction,
      }
    }

    // 通常: 新しい履歴エントリを追加
    const newPast = [...undoState.past, undoState.present]
    if (newPast.length > MAX_HISTORY) {
      newPast.shift()
    }

    return {
      past: newPast,
      present: newPresent,
      future: [],
      lastAction,
    }
  }

  const [undoState, rawDispatch] = useReducer(undoableReducer, {
    past: [],
    present: initialState,
    future: [],
    lastAction: null,
  })

  const undo = useCallback(() => rawDispatch({ type: "UNDO" } as A), [])
  const redo = useCallback(() => rawDispatch({ type: "REDO" } as A), [])

  return {
    state: undoState.present,
    dispatch: rawDispatch,
    previousState: undoState.past.at(-1),
    nextState: undoState.future.at(0),
    undo,
    redo,
  }
}
