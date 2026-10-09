"use client"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { formatComparedTargetName } from "@/lib/shared/gradeComparisonNames"

import { COMPARISON_SYMBOLS } from "../comparison-marks/comparisonSymbols"
import type {
  ComparisonDirection,
  ComparisonMark,
} from "../comparison-marks/types"
import type { ComparisonDisplay } from "./types"

/** 記号の出し方（"none" は記号ごと出さないので、ここには来ない） */
type VisibleDisplay = Exclude<ComparisonDisplay, "none">

/**
 * 出し方ごとの見た目。→ と ・ はどの出し方でも薄いまま、動いたもの（↑↓）と
 * 上下を決められないもの（*）だけが「強調」で背景を塗って目立つ。記号と意味は
 * 出力と共通（`COMPARISON_SYMBOLS`）。
 */
const MARK_CLASS_NAMES: Record<
  ComparisonDirection,
  Record<VisibleDisplay, string>
> = {
  up: {
    symbol: "text-emerald-600 dark:text-emerald-400",
    highlight: "bg-emerald-600 text-white",
  },
  down: {
    symbol: "text-rose-600 dark:text-rose-400",
    highlight: "bg-rose-600 text-white",
  },
  same: {
    symbol: "text-muted-foreground/50",
    highlight: "text-muted-foreground/50",
  },
  unknown: {
    symbol: "text-amber-600 dark:text-amber-400",
    highlight: "bg-amber-500 text-white",
  },
  missing: {
    symbol: "text-muted-foreground/40",
    highlight: "text-muted-foreground/40",
  },
}

/**
 * 記号1つ。**1文字ずつ同じ幅の箱に入れる**ので、全角の「・」が混じっても、
 * 背景を塗っても、列の中で何番目の記号かが縦に揃う。
 */
function MarkSymbol({
  direction,
  display,
}: {
  direction: ComparisonDirection
  display: VisibleDisplay
}) {
  const { symbol, description } = COMPARISON_SYMBOLS[direction]
  return (
    <span
      className={`inline-block w-4 rounded-sm text-center ${MARK_CLASS_NAMES[direction][display]}`}
      title={description}
    >
      {symbol}
    </span>
  )
}

function formatPercentage(percentage: number | null) {
  return percentage === null ? "-" : `${percentage.toFixed(1)}%`
}

interface ComparisonMarksProps {
  marks: ComparisonMark[]
  /** 今回の評定と達成率（ポップオーバーの先頭に出す） */
  currentGradeLabel: string | null
  currentPercentage: number | null
  display: VisibleDisplay
}

/**
 * 結果のマスに並べる比較の記号。登録順に1文字ずつ並べ、位置は詰めない。
 *
 * 評定バッジの中の矢印（上書きの向き）と見分けられるよう、バッジの外に
 * 点線の枠で囲んで置く。出し方（`display`）は結果画面の「変化の表示」が決める。
 * クリックで比較先の値を一覧する。
 */
export function ComparisonMarks({
  marks,
  currentGradeLabel,
  currentPercentage,
  display,
}: ComparisonMarksProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex gap-px rounded border border-dashed p-px text-xs leading-4 hover:bg-muted"
          aria-label="比較先の値を見る"
        >
          {marks.map((mark) => (
            <MarkSymbol
              key={mark.comparisonId}
              direction={mark.direction}
              display={display}
            />
          ))}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <Table className="w-auto text-xs">
          <TableBody>
            <TableRow>
              <TableCell className="py-1 pr-3 pl-0 font-medium" colSpan={2}>
                今回
              </TableCell>
              <TableCell className="py-1 pr-3 pl-0 text-right tabular-nums">
                {formatPercentage(currentPercentage)}
              </TableCell>
              <TableCell className="px-0 py-1 font-medium">
                {currentGradeLabel ?? "-"}
              </TableCell>
            </TableRow>
            {marks.map((mark) => (
              <TableRow key={mark.comparisonId} className="border-b-0">
                <TableCell className="py-1 pr-2 pl-0">
                  <MarkSymbol direction={mark.direction} display={display} />
                </TableCell>
                <TableCell className="py-1 pr-3 pl-0 whitespace-normal">
                  {formatComparedTargetName(
                    mark.comparedGradeName,
                    mark.comparedGradeItemName
                  )}
                </TableCell>
                <TableCell className="py-1 pr-3 pl-0 text-right tabular-nums">
                  {formatPercentage(mark.comparedPercentage)}
                </TableCell>
                <TableCell className="px-0 py-1">
                  {mark.comparedGradeLabel ?? "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {marks.some((mark) => mark.direction === "unknown") && (
          <p className="mt-2 text-xs text-muted-foreground">
            *
            はどちらかの評定がこの項目の成績境界に無いため、上下を決められません
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
