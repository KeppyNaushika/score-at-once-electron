"use client"

import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import Image from "next/image"

import type { NUpSize } from "@/lib/pdf-tools/nUpLayout"
import { cn } from "@/lib/utils"
import type { OutputPage } from "@/types/pdfTools.types"

import PageCardActions from "./PageCardActions"
import { describePlacement, type PagePlacement } from "./pagePlacements"
import PlacementBadge from "./PlacementBadge"
import SheetFrame from "./SheetFrame"
import type { SheetFrameSpec } from "./sheetFrames"

interface SortablePageItemProps {
  page: OutputPage
  placement: PagePlacement | undefined
  /** ページを入れる面ごとの枠（外側の面から） */
  sheetFrames: SheetFrameSpec[]
  disabled: boolean
  /** フォーカスを受けるカードの要素（キーボードで除外したあと、隣へフォーカスを移すのに使う） */
  cardRef: (element: HTMLDivElement) => () => void
  /** 除外する。trigger はキー操作かボタンか（キー操作なら隣へフォーカスを移す） */
  onDelete: (trigger: "keyboard" | "pointer") => void
  onRotateLeft: () => void
  onRotateRight: () => void
  /** サムネイル画像を読み込んだ（寸法。読めなかったら null） */
  onThumbnailMeasured: (size: NUpSize | null) => void
}

/**
 * 出力プレビューの1ページ（1マス）。
 *
 * フォーカスした状態で R（Shift+R で左）で回し、Delete / Backspace で除外できる。
 * Space / Enter はドラッグ（dnd-kit のキーボード操作）に使われる。
 */
export default function SortablePageItem({
  page,
  placement,
  sheetFrames,
  disabled,
  cardRef,
  onDelete,
  onRotateLeft,
  onRotateRight,
  onThumbnailMeasured,
}: SortablePageItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // ファイル名の短縮表示
  const shortFileName =
    page.sourceFileName.length > 8
      ? page.sourceFileName.slice(0, 6) + "…"
      : page.sourceFileName

  // 横倒しにしたページがマス（3:4）からはみ出さないよう、縮めてから回す
  const isSideways = page.rotation === 90 || page.rotation === 270
  const rotationStyle = {
    transform: `rotate(${page.rotation}deg)${isSideways ? " scale(0.75)" : ""}`,
  }

  const placementDescription =
    placement === undefined ? "" : `、${describePlacement(placement)}`

  // dnd-kit の Space / Enter は内側のマスが受け、ここには回転・除外のキーだけが届く
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === "r" || e.key === "R") {
      e.preventDefault()
      if (e.shiftKey) {
        onRotateLeft()
      } else {
        onRotateRight()
      }
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault()
      onDelete("keyboard")
    }
  }

  // 外側のラッパーを @container にする。枠線（border-2）の付いたカード自身にすると、
  // 幅を枠線の内側で測り、バッジ・帯・ボタンの切り替えがカードの外寸とずれる
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("@container relative", isDragging && "z-50")}
      onKeyDown={handleKeyDown}
    >
      {placement &&
        !isDragging &&
        sheetFrames.map((sheetFrame) => (
          <SheetFrame
            key={sheetFrame.key}
            frame={sheetFrame}
            outputPageNumber={placement.outputPageNumber}
          />
        ))}

      <div
        ref={cardRef}
        className={cn(
          "group relative aspect-3/4 cursor-grab overflow-hidden rounded-lg border-2 bg-white shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
          isDragging ? "opacity-50 shadow-lg" : "hover:border-primary/50",
          disabled && "cursor-not-allowed opacity-50"
        )}
        {...attributes}
        {...listeners}
        aria-label={`${page.sourceFileName} ${page.sourcePageNumber}ページ${placementDescription}`}
      >
        {/* サムネイル */}
        <div className="relative h-full w-full overflow-hidden">
          {page.thumbnail ? (
            <Image
              src={page.thumbnail}
              alt={`Page ${page.sourcePageNumber}`}
              fill
              unoptimized
              className="object-contain"
              style={page.rotation !== 0 ? rotationStyle : undefined}
              // 面の格子を出力と同じ寸法で選ぶため、回す前の画像の寸法を測って渡す
              onLoad={(e) =>
                onThumbnailMeasured({
                  width: e.currentTarget.naturalWidth,
                  height: e.currentTarget.naturalHeight,
                })
              }
              onError={() => onThumbnailMeasured(null)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <span className="text-xs text-muted-foreground">
                {page.sourcePageNumber}
              </span>
            </div>
          )}
        </div>

        <PageCardActions
          disabled={disabled}
          onRotateLeft={onRotateLeft}
          onRotateRight={onRotateRight}
          onDelete={() => onDelete("pointer")}
        />

        {/* ドラッグハンドル */}
        <div className="absolute top-1 left-1 rounded bg-black/40 p-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <GripVertical className="h-3 w-3 text-white" />
        </div>

        {/* ページ情報 */}
        <div
          className="absolute right-0 bottom-0 left-0 bg-black/60 px-1 py-0.5"
          title={page.sourceFileName}
        >
          <div className="flex items-center justify-end gap-1 @min-[80px]:justify-between">
            <span className="hidden min-w-0 truncate text-[10px] text-white @min-[80px]:inline">
              {shortFileName}
            </span>
            <span className="shrink-0 text-[10px] whitespace-nowrap text-white/80">
              {page.rotation !== 0 && `${page.rotation}° `}
              {page.sourcePageNumber}
            </span>
          </div>
        </div>

        {placement && <PlacementBadge placement={placement} />}
      </div>
    </div>
  )
}
