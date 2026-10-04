import { getModifierKeyLabel } from "@/lib/platformUtils"

import { MAX_SCORE } from "./constants"
import type { DemoCell } from "./types"

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
