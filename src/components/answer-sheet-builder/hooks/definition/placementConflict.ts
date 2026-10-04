/**
 * 隣り合う設問の配置設定のぶつかり（「N行上に戻す」と「この後で改行」）。
 */

import type { NextPlacement } from "@/types/answerSheetDefinition.types"

/** ぶつかった相手から降ろす設定（立てた側と逆の一方だけが入る） */
interface ClearedPlacement {
  nextPlacement?: undefined
  goUp?: undefined
}

/**
 * 「N行上に戻す」と「この後で改行」は隣り合う要素と両立しない。
 *
 * 片方を立てたら、ぶつかる相手の設定を降ろす。**降ろす先は別のレコードなので、別の
 * 意図として送る** — 1つの更新に隣の値を混ぜると、その隣を DB へ書く経路が無くなる。
 * 隣を見るのでここだけは並びの位置で辿る（id では「隣」を言えない）。
 */
export function conflictingNeighbour<
  TQuestion extends { nextPlacement?: NextPlacement; goUp?: number },
>(
  siblings: TQuestion[],
  index: number,
  data: { goUp?: number; nextPlacement?: NextPlacement }
): { question: TQuestion; cleared: ClearedPlacement } | null {
  if (data.goUp != null && index > 0) {
    const previous = siblings[index - 1]
    if (previous.nextPlacement === "break") {
      return { question: previous, cleared: { nextPlacement: undefined } }
    }
  }
  if (data.nextPlacement === "break" && index < siblings.length - 1) {
    const next = siblings[index + 1]
    if (next.goUp != null) {
      return { question: next, cleared: { goUp: undefined } }
    }
  }
  return null
}
