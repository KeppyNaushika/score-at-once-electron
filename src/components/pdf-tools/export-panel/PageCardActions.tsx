"use client"

import { RotateCcw, RotateCw, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * ボタンの大きさ。カード（`@container`）が狭いと小さくし、それでも1行に入らなければ
 * 折り返して2行にする（カード48pxでも、押せる20pxのボタンが2つずつ収まる）
 */
const BUTTON_CLASS =
  "pointer-events-auto rounded-full p-1 shadow-md transition-colors @min-[96px]:p-1.5"
const ICON_CLASS = "size-3 @min-[96px]:size-3.5"

interface PageCardActionsProps {
  disabled: boolean
  onRotateLeft: () => void
  onRotateRight: () => void
  onDelete: () => void
}

/**
 * プレビューのカードに重ねる操作ボタン（回転・除外）。
 *
 * focus-within で出すと、クリックやドロップの後もフォーカスが残ったカードが
 * 暗いままになる。キーボードで来たとき（focus-visible）だけ出す。ポインタで
 * フォーカスしたカードでも R・Delete は効き、キーを押せば focus-visible になる。
 * ボタンは Tab で止まらない（キー操作はカードが受ける）
 */
export default function PageCardActions({
  disabled,
  onRotateLeft,
  onRotateRight,
  onDelete,
}: PageCardActionsProps) {
  return (
    // 重なり順: 出ている間（hover / focus-visible）だけ z-10 で、帯・番号バッジ・つまみより
    // 上に置く（カードが狭いと2行に折り返したボタンがそれらと重なり、押せなくなる）。
    // 隠れている間は z を付けず、DOM の順で帯・バッジ・つまみが上に来て、それらの
    // title などを邪魔しない。オーバーレイ自体は常に pointer-events-none で、ドラッグは
    // ボタンの上からでもカードに届く
    <div
      className={cn(
        "pointer-events-none absolute inset-0 flex flex-wrap content-center items-center justify-center gap-0.5 bg-black/40 opacity-0 transition-opacity @min-[96px]:gap-1.5",
        !disabled &&
          "group-hover:z-10 group-hover:opacity-100 group-focus-visible:z-10 group-focus-visible:opacity-100"
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        className={cn(
          BUTTON_CLASS,
          "bg-white/90 text-foreground hover:bg-white"
        )}
        onClick={(e) => {
          e.stopPropagation()
          onRotateLeft()
        }}
        disabled={disabled}
        title="左に90°回転（Shift+R）"
      >
        <RotateCcw className={ICON_CLASS} />
      </button>
      <button
        type="button"
        tabIndex={-1}
        className={cn(
          BUTTON_CLASS,
          "bg-white/90 text-foreground hover:bg-white"
        )}
        onClick={(e) => {
          e.stopPropagation()
          onRotateRight()
        }}
        disabled={disabled}
        title="右に90°回転（R）"
      >
        <RotateCw className={ICON_CLASS} />
      </button>
      <button
        type="button"
        tabIndex={-1}
        className={cn(BUTTON_CLASS, "bg-red-500 text-white hover:bg-red-600")}
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        disabled={disabled}
        title="除外（Delete）"
      >
        <Trash2 className={ICON_CLASS} />
      </button>
    </div>
  )
}
