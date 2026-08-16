import { useCallback, useState } from "react"

import { smartFillCheckbox } from "../utils/smartFill"

/**
 * マス1つの位置。
 *
 * **行と列は実体をそのまま持つ。** id へ潰すと、塗り終えたあとに呼び出し側が
 * `.find` で引き直すことになる（既に手元にある実体の作り直し）。添字は範囲の
 * 計算にだけ使う。
 */
interface CellPosition<TRow, TCol> {
  row: TRow
  col: TCol
  rowIndex: number
  colIndex: number
}

/**
 * フィルハンドルのドラッグ状態
 */
interface FillHandleState<TRow, TCol> {
  isDragging: boolean
  startCell: CellPosition<TRow, TCol> | null
  currentCell: CellPosition<TRow, TCol> | null
  selectedRange: CellPosition<TRow, TCol>[]
  initialValues: boolean[]
}

/**
 * フィル完了時の更新データ
 */
export interface FillUpdate<TRow, TCol> {
  row: TRow
  col: TCol
  value: boolean
}

/** 掴んでいないときの姿 */
const IDLE_FILL_HANDLE_STATE = {
  isDragging: false,
  startCell: null,
  currentCell: null,
  selectedRange: [],
  initialValues: [],
}

/**
 * useFillHandleDrag のパラメータ
 */
interface UseFillHandleDragParams<TRow, TCol> {
  /**
   * フィル完了時のコールバック
   * 範囲内の全セルの更新データを受け取る
   */
  onFillComplete: (updates: FillUpdate<TRow, TCol>[]) => Promise<void>
  /** 行データの配列（範囲計算で添字から行を引くため） */
  rows: TRow[]
  /** 列データの配列（範囲計算で添字から列を引くため） */
  cols: TCol[]
}

/**
 * フィルハンドルのドラッグ操作を管理するカスタムフック
 *
 * @param params - フック設定パラメータ
 * @returns フィルハンドルの状態とイベントハンドラー
 */
export function useFillHandleDrag<
  TRow extends { id: string },
  TCol extends { id: string },
>({ onFillComplete, rows, cols }: UseFillHandleDragParams<TRow, TCol>) {
  const [state, setState] = useState<FillHandleState<TRow, TCol>>(
    IDLE_FILL_HANDLE_STATE
  )

  /**
   * フィルハンドルを掴んだ（ドラッグ開始）
   */
  const handleFillHandlePointerDown = useCallback(
    (cell: CellPosition<TRow, TCol>, initialValue: boolean) => {
      setState({
        isDragging: true,
        startCell: cell,
        currentCell: cell,
        selectedRange: [cell],
        initialValues: [initialValue],
      })
    },
    []
  )

  /**
   * セルへのポインタ進入（ドラッグ中の範囲選択）
   */
  const handleCellPointerEnter = useCallback(
    (cell: CellPosition<TRow, TCol>) => {
      setState((prev) => {
        if (!prev.isDragging || !prev.startCell) return prev

        // 範囲を計算（縦・横・長方形すべて対応）
        const range = calculateRange(prev.startCell, cell, rows, cols)

        return {
          ...prev,
          currentCell: cell,
          selectedRange: range,
        }
      })
    },
    [rows, cols]
  )

  /**
   * 指を離した（ドラッグ完了 + スマートフィル適用）。**ここが操作の終わり**。
   *
   * 保存は `setState` の更新関数の外で呼ぶ。更新関数は React が2度走らせること
   * があり、中で書くと同じマスを2回作りに行く（1マス＝1レコードになったので、
   * かつてのような「全消し→作り直し」の冪等性はもう無い）。
   */
  const handlePointerUp = useCallback(() => {
    if (!state.isDragging || state.selectedRange.length === 0) {
      setState(IDLE_FILL_HANDLE_STATE)
      return
    }

    // スマートフィル適用
    const filledValues = smartFillCheckbox(
      state.initialValues,
      state.selectedRange.length
    )

    const updates: FillUpdate<TRow, TCol>[] = state.selectedRange.map(
      (cell, index) => ({
        row: cell.row,
        col: cell.col,
        value: filledValues[index],
      })
    )

    setState(IDLE_FILL_HANDLE_STATE)
    onFillComplete(updates).catch((error) => {
      console.error("フィル完了コールバックエラー:", error)
    })
  }, [state, onFillComplete])

  /**
   * 指定されたセルが選択範囲に含まれるかを判定
   */
  const isInFillRange = useCallback(
    (row: TRow, col: TCol): boolean => {
      if (!state.isDragging) return false

      return state.selectedRange.some(
        (cell) => cell.row.id === row.id && cell.col.id === col.id
      )
    },
    [state.isDragging, state.selectedRange]
  )

  return {
    handleFillHandlePointerDown,
    handleCellPointerEnter,
    handlePointerUp,
    isInFillRange,
  }
}

/**
 * セル範囲を計算（縦・横・長方形すべて対応）
 */
function calculateRange<TRow, TCol>(
  start: CellPosition<TRow, TCol>,
  end: CellPosition<TRow, TCol>,
  rows: TRow[],
  cols: TCol[]
): CellPosition<TRow, TCol>[] {
  const minRowIndex = Math.min(start.rowIndex, end.rowIndex)
  const maxRowIndex = Math.max(start.rowIndex, end.rowIndex)
  const minColIndex = Math.min(start.colIndex, end.colIndex)
  const maxColIndex = Math.max(start.colIndex, end.colIndex)

  const range: CellPosition<TRow, TCol>[] = []

  // 長方形範囲内の全セルを生成
  for (let rowIdx = minRowIndex; rowIdx <= maxRowIndex; rowIdx++) {
    for (let colIdx = minColIndex; colIdx <= maxColIndex; colIdx++) {
      const row = rows[rowIdx]
      const col = cols[colIdx]

      if (row && col) {
        range.push({ row, col, rowIndex: rowIdx, colIndex: colIdx })
      }
    }
  }

  return range
}
