"use client"

import { ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SubtotalInfo } from "@/types/projectArchive.types"

import { SubtotalPreview } from "./SubtotalPreview"
import type { NoMatchDecisionType, NoMatchItemRowProps } from "./types"

/**
 * マッチしなかったアイテムの行（共通コンポーネント）
 */
export function NoMatchItemRow({
  item,
  onDecisionChange,
}: NoMatchItemRowProps) {
  const [decision, setDecision] = useState<NoMatchDecisionType>("create_new")
  const [showPreview, setShowPreview] = useState(false)

  const handleDecisionChange = (value: string) => {
    const newDecision = value as NoMatchDecisionType
    setDecision(newDecision)
    onDecisionChange(newDecision)
  }

  const importSubtotals = (
    item as { additionalInfo?: { importSubtotals?: SubtotalInfo[] } }
  ).additionalInfo?.importSubtotals
  const hasSubtotalPreview = !!importSubtotals?.length

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="font-medium">{item.displayLabel}</span>
          {hasSubtotalPreview && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground ml-1 inline-flex items-center gap-0.5 text-xs"
              onClick={() => setShowPreview((v) => !v)}
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
        <span className="text-muted-foreground text-xs">
          このPCに同じデータなし
        </span>
      </div>

      {/* 小計項目プレビュー */}
      {hasSubtotalPreview && showPreview && (
        <SubtotalPreview importSubtotals={importSubtotals} />
      )}

      <Select value={decision} onValueChange={handleDecisionChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="create_new">新しく登録する</SelectItem>
          <SelectItem value="skip">取り込まない</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
