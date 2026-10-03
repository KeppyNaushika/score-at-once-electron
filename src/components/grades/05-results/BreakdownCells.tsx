import type { ReactNode } from "react"

/**
 * 算出根拠の表で共有する、数値の書式と桁を揃えたセル。
 */

/** 数値を小数digits桁で表示（末尾の余分な0は残す＝式の桁を揃える） */
export function fmt(value: number, digits = 2): string {
  return value.toFixed(digits)
}

/** 数字1文字と同じ幅の空白（U+2007）。tabular-nums と併用で桁が縦に揃う。 */
const FIGURE_SPACE = " "

/**
 * 同じ列に並ぶ数値文字列を、小数点の位置で縦に揃えつつ全行を同じ文字幅になるよう
 * figure space でパディングして返す。等幅になるので、セル側は普通に text-center
 * するだけで「桁は揃ったままブロックごと中央」に置ける。
 * 数値として解釈できない要素（"—" / "欠" / "-" 等）はそのまま返す。
 */
export function alignColumn(cells: string[]): string[] {
  const parsed = cells.map((cell) => /^(-?\d+)(\.\d+)?(%?)$/.exec(cell))
  const maxInt = Math.max(0, ...parsed.map((match) => match?.[1].length ?? 0))
  const maxFrac = Math.max(0, ...parsed.map((match) => match?.[2]?.length ?? 0))
  const maxSuffix = Math.max(
    0,
    ...parsed.map((match) => match?.[3]?.length ?? 0)
  )
  return cells.map((cell, index) => {
    const match = parsed[index]
    if (!match) return cell
    const intPart = match[1]
    const fracPart = match[2] ?? ""
    const suffix = match[3] ?? ""
    return (
      FIGURE_SPACE.repeat(maxInt - intPart.length) +
      intPart +
      fracPart +
      FIGURE_SPACE.repeat(maxFrac - fracPart.length) +
      suffix +
      FIGURE_SPACE.repeat(maxSuffix - suffix.length)
    )
  })
}

/**
 * 数値セル。中身は alignColumn で列内を等幅（figure spaceパディング）に揃えた
 * 文字列を渡す前提。等幅なので text-center で桁を保ったまま中央に置ける。
 */
export function NumCell({
  children,
  className = "",
  colSpan,
}: {
  children: ReactNode
  className?: string
  colSpan?: number
}) {
  return (
    <td
      colSpan={colSpan}
      className={`text-center whitespace-nowrap tabular-nums ${className}`}
    >
      {children}
    </td>
  )
}
