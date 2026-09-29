"use client"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

import type { ComparisonEmphasis, ComparisonMark } from "./types"

/** 強調の段階（off は記号ごと出さないので、ここには来ない） */
type VisibleEmphasis = Exclude<ComparisonEmphasis, "off">

/**
 * 記号と強さごとの見た目。→ と ・ はどの強さでも薄いまま、動いたもの（↑↓）と
 * 上下を決められないもの（*）だけが強さに応じて目立つ。
 */
const MARK_STYLES: Record<
  ComparisonMark["direction"],
  {
    symbol: string
    classNameByEmphasis: Record<VisibleEmphasis, string>
    description: string
  }
> = {
  up: {
    symbol: "↑",
    classNameByEmphasis: {
      symbol: "text-emerald-600 dark:text-emerald-400",
      tint: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200",
      solid: "bg-emerald-600 text-white",
    },
    description: "上がった",
  },
  down: {
    symbol: "↓",
    classNameByEmphasis: {
      symbol: "text-rose-600 dark:text-rose-400",
      tint: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200",
      solid: "bg-rose-600 text-white",
    },
    description: "下がった",
  },
  same: {
    symbol: "→",
    classNameByEmphasis: {
      symbol: "text-muted-foreground/50",
      tint: "text-muted-foreground/50",
      solid: "text-muted-foreground/50",
    },
    description: "同じ",
  },
  unknown: {
    symbol: "*",
    classNameByEmphasis: {
      symbol: "text-amber-600 dark:text-amber-400",
      tint: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200",
      solid: "bg-amber-500 text-white",
    },
    description: "成績境界に無い評定なので上下を決められない",
  },
  missing: {
    symbol: "・",
    classNameByEmphasis: {
      symbol: "text-muted-foreground/40",
      tint: "text-muted-foreground/40",
      solid: "text-muted-foreground/40",
    },
    description: "比較先に評定が無い",
  },
}

/**
 * 記号1つ。**1文字ずつ同じ幅の箱に入れる**ので、全角の「・」が混じっても、
 * 背景を塗っても、列の中で何番目の記号かが縦に揃う。
 */
function MarkSymbol({
  direction,
  emphasis,
}: {
  direction: ComparisonMark["direction"]
  emphasis: VisibleEmphasis
}) {
  const style = MARK_STYLES[direction]
  return (
    <span
      className={`inline-block w-4 rounded-sm text-center ${style.classNameByEmphasis[emphasis]}`}
      title={style.description}
    >
      {style.symbol}
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
  emphasis: VisibleEmphasis
}

/**
 * 結果のマスに並べる比較の記号。登録順に1文字ずつ並べ、位置は詰めない。
 *
 * 評定バッジの中の矢印（上書きの向き）と見分けられるよう、バッジの外に
 * 点線の枠で囲んで置く。強さ（`emphasis`）は結果画面のスライダーが決める。
 * クリックで比較先の値を一覧する。
 */
export function ComparisonMarks({
  marks,
  currentGradeLabel,
  currentPercentage,
  emphasis,
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
              emphasis={emphasis}
            />
          ))}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <table className="text-xs">
          <tbody>
            <tr className="border-b">
              <td className="py-1 pr-3 font-medium" colSpan={2}>
                今回
              </td>
              <td className="py-1 pr-3 text-right tabular-nums">
                {formatPercentage(currentPercentage)}
              </td>
              <td className="py-1 font-medium">{currentGradeLabel ?? "-"}</td>
            </tr>
            {marks.map((mark) => (
              <tr key={mark.comparisonId}>
                <td className="py-1 pr-2">
                  <MarkSymbol direction={mark.direction} emphasis={emphasis} />
                </td>
                <td className="py-1 pr-3">
                  {mark.comparedGradeName === null
                    ? mark.comparedGradeItemName
                    : `${mark.comparedGradeName} > ${mark.comparedGradeItemName}`}
                </td>
                <td className="py-1 pr-3 text-right tabular-nums">
                  {formatPercentage(mark.comparedPercentage)}
                </td>
                <td className="py-1">{mark.comparedGradeLabel ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
