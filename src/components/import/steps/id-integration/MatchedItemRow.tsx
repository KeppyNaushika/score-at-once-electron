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
import type { IdChoice } from "@/types/examArchive.types"
import { isIdChoice } from "@/types/examArchive.types"

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

  const handleIdChoiceChange = (value: string) => {
    if (!isIdChoice(value)) return
    onDecisionChange(decision, value)
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="font-medium">{item.displayLabel}</span>
          {hasSubtotalPreview && (
            <button
              type="button"
              className="ml-1 inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
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
        <span className="text-xs text-muted-foreground">
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
            <p className="mb-1 text-xs text-muted-foreground">
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
