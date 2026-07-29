/**
 * useReducerをラップするundo/redo対応の汎用フック
 *
 * past/present/futureスタックで状態履歴を管理。
 * テキスト入力連打対策のデバウンスあり。
 */

import { useCallback, useReducer, useRef } from "react"

interface UndoableState<S> {
  past: S[]
  present: S
  future: S[]
}

const MAX_HISTORY = 50
const BATCH_TIME_MS = 300

/** 履歴スキップ対象アクション */
const SKIP_HISTORY_ACTIONS = new Set([
  "SET_DEFINITION",
  "SET_RENDER_MODE",
  "UNDO",
  "REDO",
])

interface UndoableResult<S, A> {
  state: S
  dispatch: (action: A) => void
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

/** useReducerにUndo/Redo履歴管理とデバウンスを追加する汎用フック */
export function useUndoableReducer<S, A extends { type: string }>(
  innerReducer: (state: S, action: A) => S,
  initialState: S
): UndoableResult<S, A> {
  const lastActionRef = useRef<{ type: string; timestamp: number } | null>(null)

  function undoableReducer(
    undoState: UndoableState<S>,
    action: A
  ): UndoableState<S> {
    if (action.type === "UNDO") {
      if (undoState.past.length === 0) return undoState
      const previous = undoState.past[undoState.past.length - 1]
      return {
        past: undoState.past.slice(0, -1),
        present: previous,
        future: [undoState.present, ...undoState.future],
      }
    }

    if (action.type === "REDO") {
      if (undoState.future.length === 0) return undoState
      const next = undoState.future[0]
      return {
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
    const last = lastActionRef.current
    const isBatched =
      last !== null &&
      last.type === action.type &&
      now - last.timestamp < BATCH_TIME_MS
    lastActionRef.current = { type: action.type, timestamp: now }

    if (isBatched) {
      // pastは変えず、presentだけ更新
      return {
        ...undoState,
        present: newPresent,
        future: [],
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
    }
  }

  const [undoState, rawDispatch] = useReducer(undoableReducer, {
    past: [],
    present: initialState,
    future: [],
  })

  const undo = useCallback(() => rawDispatch({ type: "UNDO" } as A), [])
  const redo = useCallback(() => rawDispatch({ type: "REDO" } as A), [])

  return {
    state: undoState.present,
    dispatch: rawDispatch,
    canUndo: undoState.past.length > 0,
    canRedo: undoState.future.length > 0,
    undo,
    redo,
  }
}
