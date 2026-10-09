import type { ComparisonDirection, ComparisonMark } from "./types"

/**
 * 変化の記号と、その意味。結果画面・出力のプレビュー・Excel・個人成績通知書が
 * 同じ記号を使う。
 */
export const COMPARISON_SYMBOLS: Record<
  ComparisonDirection,
  { symbol: string; description: string }
> = {
  up: { symbol: "↑", description: "上がった" },
  down: { symbol: "↓", description: "下がった" },
  same: { symbol: "→", description: "同じ" },
  unknown: {
    symbol: "*",
    description: "成績境界に無い評定なので上下を決められない",
  },
  missing: { symbol: "・", description: "比較先に評定が無い" },
}

/** マス1つの記号を登録順に連ねる（例「↑→」） */
export function joinComparisonSymbols(
  marks: readonly ComparisonMark[]
): string {
  return marks.map((mark) => COMPARISON_SYMBOLS[mark.direction].symbol).join("")
}
