"use client"

import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import type React from "react"

import { Kbd } from "@/components/ui/kbd"
import { cn } from "@/lib/utils"

// Tooltipコンテンツのスタイル
const tooltipContentClass = cn(
  "bg-primary text-primary-foreground animate-in fade-in-0 zoom-in-95",
  "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
  "data-[side=right]:slide-in-from-left-2",
  "z-50 w-fit rounded-md px-3 py-1.5 text-xs"
)

interface PaletteTooltipProps {
  /** ツールの名前（1行目に太字で出す） */
  label: string
  /** 使い方の補足（名前の下に小さく出す） */
  note?: string
  /** 割り当てたキー（無ければキーの行を出さない） */
  shortcutKey?: string
  /** Tooltip を付けるボタン */
  children: React.ReactElement
}

/**
 * 描画ツールパレットのボタンに付ける Tooltip（右に出す）
 *
 * 共通の Tooltip ではなく Radix をじかに使う。パレットは答案の上に浮いていて、
 * 表示までの間（DrawingToolPalette の Provider）も見た目（矢印なし）も他と違うため
 */
export function PaletteTooltip({
  label,
  note,
  shortcutKey,
  children,
}: PaletteTooltipProps) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side="right"
          sideOffset={5}
          className={tooltipContentClass}
        >
          <div className="text-center">
            <div className="font-medium">{label}</div>
            {note && <div className="text-xs text-gray-400">{note}</div>}
            {shortcutKey && (
              <div className="mt-1 text-xs text-gray-400">
                キー: <Kbd variant="subtle">{shortcutKey}</Kbd>
              </div>
            )}
          </div>
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
