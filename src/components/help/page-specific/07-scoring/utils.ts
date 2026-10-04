import type { CSSProperties } from "react"

import { getModifierKeyLabel } from "@/lib/platformUtils"

import { MAX_SCORE } from "./constants"
import type { DemoCell } from "./types"

/** 説明アニメの keyframes（keyframes.ts）が読む CSS 変数 */
interface Help07CustomProperties {
  /** help07Sel：選択枠の色 */
  "--help07-sel"?: string
  /** help07Pen：線の長さ（stroke-dashoffset の始点・終点） */
  "--help07-len"?: number
}

/**
 * CSS 変数を含む style を組み立てる
 *
 * React の CSSProperties は `--*` を型に持たないため、受け取る側で
 * keyframes が読む変数名だけを足して検め、そのまま CSSProperties として返す
 */
export function withHelp07Variables(
  style: CSSProperties & Help07CustomProperties
): CSSProperties {
  return style
}

/** キー文字列を表示用に整形（"e"→"E", "Shift+d"→"Shift+D"） */
export function formatKey(key?: string): string {
  if (!key) return ""
  return key
    .split("+")
    .map((part) => (part.length === 1 ? part.toUpperCase() : part))
    .join("+")
}

/** 修飾キーを実行環境のラベルに合わせて整形（"Alt+e"→ Mac: "Option+E"） */
export function formatModKey(key?: string): string {
  return formatKey(key).replace(/Alt/gi, getModifierKeyLabel())
}

/** デモセルの採点状態に応じた点数表示（未採点は null） */
export function scoreText(cell: DemoCell): string | null {
  switch (cell.status) {
    case "correct":
      return `${MAX_SCORE}/${MAX_SCORE}`
    case "incorrect":
    case "no_answer":
      return `0/${MAX_SCORE}`
    case "partial":
      return `${cell.score ?? 0}/${MAX_SCORE}`
    case "pending":
      return `-/${MAX_SCORE}`
    default:
      return null
  }
}
