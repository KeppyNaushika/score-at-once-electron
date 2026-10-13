"use client"

import { useState } from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { IdChoice } from "@/types/examArchive.types"

import { IdChoiceSelect } from "./IdChoiceSelect"
import { ItemRowHeader } from "./ItemRowHeader"
import { SubtotalMappingEditor } from "./SubtotalMappingEditor"
import { SubtotalPreview } from "./SubtotalPreview"
import type { DecisionType, MatchedItemRowProps } from "./types"
import { ENTITY_LABELS, isDecisionType } from "./types"

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
  // 決定内容はウィザードの state が正。ローカルには複製せず props から算出する
  const decision: DecisionType = currentDecision ?? "same_person"
  const idChoice: IdChoice = currentIdChoice ?? "use_existing_id"

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
    if (!isDecisionType(value)) return
    onDecisionChange(value, value === "same_person" ? idChoice : undefined)
  }

  const handleIdChoiceChange = (newIdChoice: IdChoice) => {
    onDecisionChange(decision, newIdChoice)
  }

  return (
    <div className="rounded-lg border p-3">
      <ItemRowHeader
        displayLabel={item.displayLabel}
        matchSummary={item.matchReason}
        hasSubtotalPreview={!!hasSubtotalPreview}
        showPreview={showPreview}
        onTogglePreview={() => setShowPreview((shown) => !shown)}
      />

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
            <p className="mb-1 text-xs text-muted-foreground">
              {labels.idChoiceLabel}
            </p>
            <IdChoiceSelect
              idChoice={idChoice}
              onIdChoiceChange={handleIdChoiceChange}
            />
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
