"use client"

import { Hand, ListChecks } from "lucide-react"

import type { OwnRubricCell } from "./utils/rubricApplicationState"

interface RubricCellMarkProps {
  cell: OwnRubricCell
}

/**
 * 一覧のマスの、採点マークの左に置く小さな印（ルーブリック採点の設問だけ）。
 * 当たっている項目の数と、採点キーで上書きしていること
 */
export function RubricCellMark({ cell }: RubricCellMarkProps) {
  const appliedCount = cell.appliedItemIds.size
  if (appliedCount === 0 && !cell.overridesRubric) return null
  return (
    <span className="flex items-center gap-0.5">
      {appliedCount > 0 && (
        <span
          className="flex items-center gap-px rounded bg-blue-100 px-0.5 text-[10px] leading-3 text-blue-800"
          title={`ルーブリック項目が${appliedCount}つ当たっています`}
          aria-label={`項目${appliedCount}つ`}
        >
          <ListChecks className="h-2.5 w-2.5" />
          {appliedCount}
        </span>
      )}
      {cell.overridesRubric && (
        <span
          className="rounded bg-orange-100 px-0.5 text-orange-700"
          title="採点キーで付けた点が項目より優先しています（手での上書き）"
          aria-label="手での上書き"
        >
          <Hand className="h-2.5 w-2.5" />
        </span>
      )}
    </span>
  )
}
