import { cn } from "@/lib/utils"

import type { SheetFrameSpec } from "./sheetFrames"

/**
 * 最も外側の面（出力の1ページ）をくくる枠の色。隣り合う面を見分けられれば足りるので、
 * 出力のページ番号で巡回させる（Tailwind がクラス名を拾えるよう、組み立てずに書き並べる）
 */
const SHEET_FRAME_COLORS = [
  "border-sky-500",
  "border-amber-500",
  "border-emerald-500",
  "border-fuchsia-500",
]

interface SheetFrameProps {
  frame: SheetFrameSpec
  outputPageNumber: number
}

/**
 * 同じ面のページをくくる枠（プレビューのカード1枚分。隣のマスと辺を開けてつなぐ）。
 *
 * 最も外側の面（出力の1ページ）は色の枠を gap の半分だけ外へ出して描く。外へ出たぶんは、
 * プレビューのスクロール領域の内側の余白に収める（ExportPanel）。全体 N-up でその中に
 * 入るファイルごとの面は、その内側に破線の枠で描く。色は出力のページを見分けるための
 * ものなので、内側は色を変えず線の種類で段を見分けさせる
 */
export default function SheetFrame({
  frame,
  outputPageNumber,
}: SheetFrameProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute border-2",
        frame.level === 0
          ? [
              "-inset-1",
              SHEET_FRAME_COLORS[outputPageNumber % SHEET_FRAME_COLORS.length],
            ]
          : "-inset-0.5 border-dashed border-muted-foreground/70",
        frame.joinsPrevious ? "border-l-0" : "rounded-l-xl",
        frame.joinsNext ? "border-r-0" : "rounded-r-xl"
      )}
    />
  )
}
