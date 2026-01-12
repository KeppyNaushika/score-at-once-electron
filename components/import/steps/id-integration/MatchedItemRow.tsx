"use client"

import { useState } from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { IdChoice } from "@/types/projectArchive.types"

import type { DecisionType, MatchedItemRowProps } from "./types"
import { ENTITY_LABELS } from "./types"

/**
 * マッチしたアイテムの行（共通コンポーネント）
 */
export function MatchedItemRow({
  item,
  entityType,
  onDecisionChange,
}: MatchedItemRowProps) {
  const [decision, setDecision] = useState<DecisionType>("same_person")
  const [idChoice, setIdChoice] = useState<IdChoice>("use_existing_id")

  const labels = ENTITY_LABELS[entityType]

  const handleDecisionChange = (value: string) => {
    const newDecision = value as DecisionType
    setDecision(newDecision)
    onDecisionChange(
      newDecision,
      newDecision === "same_person" ? idChoice : undefined
    )
  }

  const handleIdChoiceChange = (value: string) => {
    const newIdChoice = value as IdChoice
    setIdChoice(newIdChoice)
    onDecisionChange(decision, newIdChoice)
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">{item.displayLabel}</span>
        <span className="text-muted-foreground text-xs">
          {item.matchReason}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <Select value={decision} onValueChange={handleDecisionChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="same_person">{labels.samePerson}</SelectItem>
            <SelectItem value="create_new">{labels.createNew}</SelectItem>
            <SelectItem value="skip">{labels.skip}</SelectItem>
          </SelectContent>
        </Select>

        {/* 同一として扱う場合のID選択 */}
        {decision === "same_person" && (
          <div className="mt-1 ml-4">
            <p className="text-muted-foreground mb-1 text-xs">
              {labels.idChoiceLabel}
            </p>
            <Select value={idChoice} onValueChange={handleIdChoiceChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="use_existing_id">
                  このPCに合わせる
                </SelectItem>
                <SelectItem value="use_import_id">
                  書き出したPCに合わせる
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  )
}
