interface ClampedNumberRange {
  min: number
  max?: number
  /** 整数に丸める（列数など） */
  integer?: boolean
}

/**
 * 入力欄の文字を範囲内の数にする。数にできないとき（空・`-`・`e` など）は null
 *
 * `Number("")` は 0 なので、空を下限として書き込まないよう先に弾く。
 */
export function parseClampedNumber(
  text: string,
  { min, max = Infinity, integer = false }: ClampedNumberRange
): number | null {
  if (text.trim() === "") return null
  const parsed = Number(text)
  if (!Number.isFinite(parsed)) return null
  const rounded = integer ? Math.round(parsed) : parsed
  return Math.min(max, Math.max(min, rounded))
}
