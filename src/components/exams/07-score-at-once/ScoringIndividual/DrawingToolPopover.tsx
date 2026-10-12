"use client"

import type { LucideIcon } from "lucide-react"
import type React from "react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatKeyForDisplay } from "@/lib/shortcutCatalog"

import { PaletteTooltip } from "./PaletteTooltip"
import type { CanvasTool } from "./types"

interface DrawingToolPopoverProps {
  /** このボタンが受け持つ描画ツール */
  tool: CanvasTool
  currentTool: CanvasTool
  onToolChange: (tool: CanvasTool) => void
  icon: LucideIcon
  /** Tooltip に出すツール名 */
  tooltipLabel: string
  /** Tooltip に出す使い方の補足 */
  tooltipNote: string
  /** Popover 見出し（ツール選択中） */
  toolHeading: string
  /** Popover 見出し（このタイプの要素を選択中） */
  selectedHeading: string
  /** アクティブ時のボタン背景・枠の色 */
  activeColor: string
  hasSelectedElement?: boolean // このタイプの要素が選択されているか
  hasOtherTypeSelected?: boolean // 他のタイプの要素が選択されているか
  onClearSelection?: () => void
  shortcutKey?: string
  /** Popover 内の設定コントロール（見出しの下に並ぶ） */
  children: React.ReactNode
}

/**
 * 描画ツールパレットの「ツール選択ボタン＋設定 Popover」の共通の殻
 *
 * 1回目のクリックでツールを選び、選択中のツール（またはこのタイプの要素を
 * 選択中）でもう一度クリックすると設定 Popover を開閉する
 */
export function DrawingToolPopover({
  tool,
  currentTool,
  onToolChange,
  icon: ToolIcon,
  tooltipLabel,
  tooltipNote,
  toolHeading,
  selectedHeading,
  activeColor,
  hasSelectedElement = false,
  hasOtherTypeSelected = false,
  onClearSelection,
  shortcutKey,
  children,
}: DrawingToolPopoverProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleClick = (e: React.MouseEvent) => {
    // イベント伝播を停止（キャンバスのクリックハンドラに伝播しないように）
    e.stopPropagation()

    // このタイプの要素が選択されていない場合のみ選択を解除
    if (!hasSelectedElement && hasOtherTypeSelected && onClearSelection) {
      onClearSelection()
    }

    if (hasSelectedElement) {
      // このタイプの要素を選択中の場合はポップオーバーを開く
      setIsOpen(!isOpen)
    } else if (currentTool === tool) {
      // 既に選択されている場合はPopoverをトグル
      setIsOpen(!isOpen)
    } else {
      // 違うツールの場合はツールを選択
      onToolChange(tool)
      setIsOpen(false)
    }
  }

  // ボタンがアクティブ状態かどうか（ツール選択中 または このタイプの要素を選択中）
  const isActive = currentTool === tool || hasSelectedElement

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PaletteTooltip
        label={tooltipLabel}
        note={tooltipNote}
        shortcutKey={shortcutKey && formatKeyForDisplay(shortcutKey)}
        open={isOpen ? false : undefined}
      >
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant={isActive ? "default" : "ghost"}
            onClick={handleClick}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              backgroundColor: isActive ? activeColor : undefined,
              borderColor: isActive ? activeColor : undefined,
            }}
          >
            <ToolIcon
              className="h-4 w-4"
              style={{ color: isActive ? "white" : undefined }}
            />
          </Button>
        </PopoverTrigger>
      </PaletteTooltip>
      <PopoverContent className="w-64" side="right">
        <div className="space-y-3">
          <h4 className="text-sm font-medium">
            {hasSelectedElement ? selectedHeading : toolHeading}
          </h4>
          {children}
        </div>
      </PopoverContent>
    </Popover>
  )
}
