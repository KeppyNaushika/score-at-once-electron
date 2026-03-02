"use client"

import { ChevronDown, ChevronRight } from "lucide-react"
import { useEffect, useState } from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { IdChoice } from "@/types/projectArchive.types"

import { SubtotalMappingEditor } from "./SubtotalMappingEditor"
import { SubtotalPreview } from "./SubtotalPreview"
import type { DecisionType, MatchedItemRowProps } from "./types"
import { ENTITY_LABELS } from "./types"

/**
 * マッチしたアイテムの行（共通コンポーネント）
 */
export function MatchedItemRow({
  item,
  entityType,
  currentDecision,
  currentIdChoice,
  onDecisionChange,
  wizard,
}: MatchedItemRowProps) {
  const [decision, setDecision] = useState<DecisionType>(
    currentDecision ?? "same_person"
  )
  const [idChoice, setIdChoice] = useState<IdChoice>(
    currentIdChoice ?? "use_existing_id"
  )

  useEffect(() => {
    if (currentDecision !== undefined) setDecision(currentDecision)
  }, [currentDecision])

  useEffect(() => {
    if (currentIdChoice !== undefined) setIdChoice(currentIdChoice)
  }, [currentIdChoice])

  const [showPreview, setShowPreview] = useState(false)

  const labels = ENTITY_LABELS[entityType]
  const hasSubtotalPreview =
    entityType === "subtotalGroup" && item.additionalInfo
  const showMappingEditor =
    entityType === "subtotalGroup" &&
    decision === "same_person" &&
    wizard &&
    item.additionalInfo?.importSubtotals?.length &&
    item.additionalInfo?.existingSubtotals?.length

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
          {item.matchReason}
        </span>
      </div>

      {/* 小計項目プレビュー */}
      {hasSubtotalPreview && showPreview && (
        <SubtotalPreview
          importSubtotals={item.additionalInfo?.importSubtotals}
          existingSubtotals={item.additionalInfo?.existingSubtotals}
        />
      )}

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
                  このPCのIDを使う
                </SelectItem>
                <SelectItem value="use_import_id">
                  ファイルのIDを使う
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* 小計項目マッピングエディタ（subtotalGroup + same_person の場合） */}
        {showMappingEditor && (
          <SubtotalMappingEditor
            wizard={wizard}
            importSubtotals={item.additionalInfo!.importSubtotals!}
            existingSubtotals={item.additionalInfo!.existingSubtotals!}
          />
        )}
      </div>
    </div>
  )
}
