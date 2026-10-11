"use client"

import { ChevronLeft, ChevronRight, Crop, X } from "lucide-react"
import Image from "next/image"
import type { KeyboardEvent, Ref } from "react"

import { Button } from "@/components/ui/button"

/** 並びの中の動き（キーとボタンの両方から） */
export type QuestionImageAction =
  | "zoom"
  | "moveEarlier"
  | "moveLater"
  | "remove"
  | "recrop"
  | "focusPrevious"
  | "focusNext"

interface AiQuestionImageThumbnailProps {
  /** 何枚目か（0 から） */
  index: number
  count: number
  /** 表示する URL。読めていなければ "" */
  imageUrl: string
  buttonRef: Ref<HTMLButtonElement>
  onAction: (action: QuestionImageAction) => void
}

/**
 * 問題の画像1枚のサムネイル。サムネイルに焦点があるとき、Enter で拡大、Alt＋← → で並べ替え、
 * Delete で外す、← → で隣の画像へ。同じことをボタンでもできる
 */
export function AiQuestionImageThumbnail({
  index,
  count,
  imageUrl,
  buttonRef,
  onAction,
}: AiQuestionImageThumbnailProps) {
  const ordinal = `${index + 1}枚目`

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const action = keyAction(event)
    if (!action) return
    event.preventDefault()
    onAction(action)
  }

  return (
    <li className="w-28 rounded border bg-background p-1 text-xs">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`問題の画像 ${ordinal}（Enter で拡大、Alt＋← → で並べ替え、Delete で外す）`}
        onClick={() => onAction("zoom")}
        onKeyDown={handleKeyDown}
        className="flex h-24 w-full items-center justify-center overflow-hidden rounded bg-muted/40 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={`問題の画像 ${ordinal}`}
            width={112}
            height={96}
            unoptimized
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-muted-foreground">読み込み中…</span>
        )}
      </button>
      <div className="mt-1 flex items-center justify-between">
        <span className="tabular-nums">{ordinal}</span>
        <span className="flex">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label={`${ordinal}を前へ`}
            disabled={index === 0}
            onClick={() => onAction("moveEarlier")}
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label={`${ordinal}を後へ`}
            disabled={index === count - 1}
            onClick={() => onAction("moveLater")}
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label={`${ordinal}を切り出し直す`}
            disabled={!imageUrl}
            onClick={() => onAction("recrop")}
          >
            <Crop className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label={`${ordinal}を外す`}
            onClick={() => onAction("remove")}
          >
            <X className="h-3 w-3" />
          </Button>
        </span>
      </div>
    </li>
  )
}

/** サムネイルの上のキーの動き。割り当てが無ければ null */
function keyAction(
  event: KeyboardEvent<HTMLButtonElement>
): QuestionImageAction | null {
  if (event.key === "Delete" || event.key === "Backspace") return "remove"
  if (event.key === "ArrowLeft") {
    return event.altKey ? "moveEarlier" : "focusPrevious"
  }
  if (event.key === "ArrowRight") {
    return event.altKey ? "moveLater" : "focusNext"
  }
  return null
}
