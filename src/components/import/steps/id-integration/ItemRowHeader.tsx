"use client"

import { ChevronDown, ChevronRight } from "lucide-react"

interface ItemRowHeaderProps {
  /** 行の見出し（取り込む側の表示名） */
  displayLabel: string
  /** 見出しに添える、同じ名前・番号の行を見分ける材料 */
  detail?: string
  /** 右端に添える照合の結果（一致した理由、または一致なしの旨） */
  matchSummary: string
  /** 小計項目の開閉ボタンを出すか */
  hasSubtotalPreview: boolean
  showPreview: boolean
  onTogglePreview: () => void
}

/**
 * ID統合の1行の見出し（一致した行・一致しなかった行で共通）
 */
export function ItemRowHeader({
  displayLabel,
  detail,
  matchSummary,
  hasSubtotalPreview,
  showPreview,
  onTogglePreview,
}: ItemRowHeaderProps) {
  return (
    <div className="mb-2 flex items-start justify-between gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <span className="font-medium">{displayLabel}</span>
        {detail && (
          <span className="text-xs text-muted-foreground">{detail}</span>
        )}
        {hasSubtotalPreview && (
          <button
            type="button"
            className="ml-1 inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={onTogglePreview}
          >
            {showPreview ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            小計項目
          </button>
        )}
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {matchSummary}
      </span>
    </div>
  )
}
