import { useCallback, useState } from "react"
import { smartFillCheckbox } from "../utils/smart-fill"

/**
 * セル位置を表す型
 */
export interface CellPosition {
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
 *   handleFillHandleMouseDown,
 *   handleCellMouseEnter,
 *   handleMouseUp,
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
  const [state, setState] = useState<FillHandleState>({
    isDragging: false,
    startCell: null,
    currentCell: null,
    selectedRange: [],
    initialValues: [],
  })

  /**
   * フィルハンドルのマウスダウン（ドラッグ開始）
   */
  const handleFillHandleMouseDown = useCallback(
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
   * セルへのマウス進入（ドラッグ中の範囲選択）
   */
  const handleCellMouseEnter = useCallback(
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
   * マウスアップ（ドラッグ完了 + スマートフィル適用）
   */
  const handleMouseUp = useCallback(async () => {
    setState((prev) => {
      if (!prev.isDragging || prev.selectedRange.length === 0) {
        // リセットして終了
        return {
          isDragging: false,
          startCell: null,
          currentCell: null,
          selectedRange: [],
          initialValues: [],
        }
      }

      // スマートフィル適用
      const filledValues = smartFillCheckbox(
        prev.initialValues,
        prev.selectedRange.length
      )

      // 更新データ作成
      const updates: FillUpdate[] = prev.selectedRange.map((cell, index) => ({
        rowId: cell.rowId,
        colId: cell.colId,
        value: filledValues[index],
      }))

      // コールバック実行（非同期）
      onFillComplete(updates).catch((error) => {
        console.error("フィル完了コールバックエラー:", error)
      })

      // リセット
      return {
        isDragging: false,
        startCell: null,
        currentCell: null,
        selectedRange: [],
        initialValues: [],
      }
    })
  }, [onFillComplete])

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
    handleFillHandleMouseDown,
    handleCellMouseEnter,
    handleMouseUp,
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
