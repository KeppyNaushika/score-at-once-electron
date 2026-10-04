import { cn } from "@/lib/utils"

import { describeSheetCell, type SheetCell } from "./pagePlacements"

interface SheetCellFigureProps {
  cell: SheetCell
}

/**
 * 面の格子（行×列）の小さな図。ページが入るマスを塗る。
 *
 * バッジの番号は読む順（並べ方の順）なので、並べ方を変えても番号は同じまま、塗る
 * マスだけが動く。用紙の向きも図の縦横（A4 の縦横比）で見せる。
 */
export default function SheetCellFigure({ cell }: SheetCellFigureProps) {
  const gridCells = Array.from(
    { length: cell.rows * cell.columns },
    (_, cellIndex) => {
      const row = Math.floor(cellIndex / cell.columns)
      const column = cellIndex % cell.columns
      return {
        key: `${row}-${column}`,
        isTarget: row === cell.row && column === cell.column,
      }
    }
  )
  return (
    <span
      role="img"
      aria-label={describeSheetCell(cell)}
      className={cn(
        "grid shrink-0 gap-px rounded-[2px] border border-primary-foreground/70 p-px",
        cell.isLandscape ? "h-4 w-5.5" : "h-5.5 w-4"
      )}
      style={{
        gridTemplateRows: `repeat(${cell.rows}, minmax(0, 1fr))`,
        gridTemplateColumns: `repeat(${cell.columns}, minmax(0, 1fr))`,
      }}
    >
      {gridCells.map((gridCell) => (
        <span
          key={gridCell.key}
          className={
            gridCell.isTarget
              ? "bg-primary-foreground"
              : "bg-primary-foreground/25"
          }
        />
      ))}
    </span>
  )
}
