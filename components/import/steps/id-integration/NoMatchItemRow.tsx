"use client"

import { useState } from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import type { NoMatchDecisionType, NoMatchItemRowProps } from "./types"

/**
 * マッチしなかったアイテムの行（共通コンポーネント）
 */
export function NoMatchItemRow({
  item,
  onDecisionChange,
}: NoMatchItemRowProps) {
  const [decision, setDecision] = useState<NoMatchDecisionType>("create_new")

  const handleDecisionChange = (value: string) => {
    const newDecision = value as NoMatchDecisionType
    setDecision(newDecision)
    onDecisionChange(newDecision)
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">{item.displayLabel}</span>
        <span className="text-muted-foreground text-xs">
          このPCに同じデータなし
        </span>
      </div>
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
