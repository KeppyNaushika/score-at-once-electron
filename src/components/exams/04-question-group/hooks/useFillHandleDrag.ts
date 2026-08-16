import { useCallback, useState } from "react"

import { smartFillCheckbox } from "../utils/smartFill"

/**
 * セル位置を表す型
 */
interface CellPosition {
  rowId: string
  colId: string
  rowIndex: number
  colIndex: number
}

/**
 * フィルハンドルのドラッグ状態
 */
interface FillHandleState {
  isDragging: boolean
  startCell: CellPosition | null
  currentCell: CellPosition | null
  selectedRange: CellPosition[]
  initialValues: boolean[]
}

/**
 * フィル完了時の更新データ
 */
export interface FillUpdate {
  rowId: string
  colId: string
  value: boolean
}

/** 掴んでいないときの姿 */
const IDLE_FILL_HANDLE_STATE: FillHandleState = {
  isDragging: false,
  startCell: null,
  currentCell: null,
  selectedRange: [],
  initialValues: [],
}

/**
 * useFillHandleDrag のパラメータ
 */
interface UseFillHandleDragParams {
  /**
   * フィル完了時のコールバック
   * 範囲内の全セルの更新データを受け取る
   */
  onFillComplete: (updates: FillUpdate[]) => Promise<void>
  /**
   * 行データの配列（rowIndexから実際のrowIdを取得するため）
   */
  rows?: Array<{ id: string }>
  /**
   * 列データの配列（colIndexから実際のcolIdを取得するため）
   */
  cols?: Array<{ id: string }>
}

/**
 * フィルハンドルのドラッグ操作を管理するカスタムフック
 *
 * @param params - フック設定パラメータ
 * @returns フィルハンドルの状態とイベントハンドラー
 *
 * @example
 * ```tsx
 * const {
 *   fillHandleState,
 *   handleFillHandlePointerDown,
 *   handleCellPointerEnter,
 *   handlePointerUp,
 *   isInFillRange,
 * } = useFillHandleDrag({
 *   onFillComplete: async (updates) => {
 *     for (const update of updates) {
 *       await saveCell(update.rowId, update.colId, update.value)
 *     }
 *   },
 * })
 * ```
 */
export function useFillHandleDrag({
  onFillComplete,
  rows = [],
  cols = [],
}: UseFillHandleDragParams) {
  const [state, setState] = useState<FillHandleState>(IDLE_FILL_HANDLE_STATE)

  /**
   * フィルハンドルを掴んだ（ドラッグ開始）
   */
  const handleFillHandlePointerDown = useCallback(
    (cell: CellPosition, initialValue: boolean) => {
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
    (cell: CellPosition) => {
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

    const updates: FillUpdate[] = state.selectedRange.map((cell, index) => ({
      rowId: cell.rowId,
      colId: cell.colId,
      value: filledValues[index],
    }))

    setState(IDLE_FILL_HANDLE_STATE)
    onFillComplete(updates).catch((error) => {
      console.error("フィル完了コールバックエラー:", error)
    })
  }, [state, onFillComplete])

  /**
   * 指定されたセルが選択範囲に含まれるかを判定
   */
  const isInFillRange = useCallback(
    (rowId: string, colId: string): boolean => {
      if (!state.isDragging) return false

      return state.selectedRange.some(
        (cell) => cell.rowId === rowId && cell.colId === colId
      )
    },
    [state.isDragging, state.selectedRange]
  )

  // デバッグ用：ドラッグ状態をログ出力
  // useEffect(() => {
  //   if (state.isDragging) {
  //     console.log("🔵 isDragging:", state.isDragging)
  //     console.log("🔵 selectedRange:", state.selectedRange)
  //   }
  // }, [state.isDragging, state.selectedRange])

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
function calculateRange(
  start: CellPosition,
  end: CellPosition,
  rows: Array<{ id: string }>,
  cols: Array<{ id: string }>
): CellPosition[] {
  const minRowIndex = Math.min(start.rowIndex, end.rowIndex)
  const maxRowIndex = Math.max(start.rowIndex, end.rowIndex)
  const minColIndex = Math.min(start.colIndex, end.colIndex)
  const maxColIndex = Math.max(start.colIndex, end.colIndex)

  const range: CellPosition[] = []

  // 長方形範囲内の全セルを生成
  for (let rowIdx = minRowIndex; rowIdx <= maxRowIndex; rowIdx++) {
    for (let colIdx = minColIndex; colIdx <= maxColIndex; colIdx++) {
      const rowId = rows[rowIdx]?.id
      const colId = cols[colIdx]?.id

      if (rowId && colId) {
        range.push({
          rowId,
          colId,
          rowIndex: rowIdx,
          colIndex: colIdx,
        })
      }
    }
  }

  return range
}
