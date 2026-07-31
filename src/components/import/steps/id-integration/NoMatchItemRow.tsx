"use client"

import { ChevronDown, ChevronRight } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import type { IdChoice, SubtotalInfo } from "@/types/examArchive.types"

import { SubtotalMappingEditor } from "./SubtotalMappingEditor"
import { SubtotalPreview } from "./SubtotalPreview"
import type {
  DecisionType,
  NoMatchDecisionType,
  NoMatchItemRowProps,
} from "./types"

/**
 * マッチしなかったアイテムの行（共通コンポーネント）
 */
export function NoMatchItemRow({
  item,
  onDecisionChange,
  entityType,
  allExistingItems,
  wizard,
  alreadyMatchedExistingIds,
}: NoMatchItemRowProps) {
  const isSubtotalGroup = entityType === "subtotalGroup"

  // subtotalGroupは空選択（強制選択）、それ以外はcreate_newデフォルト
  const [decision, setDecision] = useState<
    NoMatchDecisionType | DecisionType | ""
  >(isSubtotalGroup ? "" : "create_new")
  const [selectedExistingId, setSelectedExistingId] = useState<string>("")
  const [idChoice, setIdChoice] = useState<IdChoice>("use_existing_id")
  const [showPreview, setShowPreview] = useState(false)

  const canManualLink =
    isSubtotalGroup && allExistingItems && allExistingItems.length > 0

  const importSubtotals = (
    item as { additionalInfo?: { importSubtotals?: SubtotalInfo[] } }
  ).additionalInfo?.importSubtotals
  const hasSubtotalPreview = !!importSubtotals?.length

  // 選択中の既存グループの小計項目
  const selectedExistingSubtotals = useMemo(() => {
    if (!selectedExistingId || !allExistingItems) return undefined
    return allExistingItems.find(
      (existing) => existing.id === selectedExistingId
    )?.subtotals
  }, [selectedExistingId, allExistingItems])

  // 小計項目マッピングエディタの表示条件
  const showMappingEditor =
    isSubtotalGroup &&
    decision === "same_person" &&
    selectedExistingId &&
    wizard &&
    importSubtotals?.length &&
    selectedExistingSubtotals?.length

  // currentDecisionの復元（wizardのstateから）
  useEffect(() => {
    if (!wizard || !isSubtotalGroup) return
    const config = wizard.state.idIntegrationConfig.subtotalGroup
    const existing = config.decisions.find(
      (decision) => decision.importId === item.importId
    )
    if (existing) {
      setDecision(existing.decisionType as DecisionType)
      if (existing.existingId) setSelectedExistingId(existing.existingId)
      if (existing.idChoice) setIdChoice(existing.idChoice)
    } else if (isSubtotalGroup) {
      // stateにない場合は空選択に戻す（一括設定のクリア等に対応）
      setDecision("")
      setSelectedExistingId("")
    }
  }, [
    wizard,
    isSubtotalGroup,
    item.importId,
    wizard?.state.idIntegrationConfig,
  ])

  const handleDecisionChange = (value: string) => {
    const newDecision = value as NoMatchDecisionType | DecisionType
    setDecision(newDecision)
    if (newDecision === "same_person") {
      if (selectedExistingId) {
        onDecisionChange(newDecision, selectedExistingId, idChoice)
      }
    } else {
      setSelectedExistingId("")
      onDecisionChange(newDecision)
    }
  }

  const handleExistingGroupChange = (existingId: string) => {
    setSelectedExistingId(existingId)
    onDecisionChange("same_person", existingId, idChoice)
    // 既存グループが変わったら小計マッピングをクリア
    if (wizard && importSubtotals) {
      wizard.clearSubtotalMappings(
        importSubtotals.map((subtotal) => subtotal.id)
      )
    }
  }

  const handleIdChoiceChange = (value: string) => {
    const newIdChoice = value as IdChoice
    setIdChoice(newIdChoice)
    if (selectedExistingId) {
      onDecisionChange("same_person", selectedExistingId, newIdChoice)
    }
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
          このPCに同じデータなし
        </span>
      </div>

      {/* 小計項目プレビュー */}
      {hasSubtotalPreview && showPreview && (
        <SubtotalPreview
          importSubtotals={importSubtotals}
          existingSubtotals={
            decision === "same_person" ? selectedExistingSubtotals : undefined
          }
        />
      )}

      <div className="flex flex-col gap-2">
        <Select
          value={decision || undefined}
          onValueChange={handleDecisionChange}
        >
          <SelectTrigger
            className={cn(
              "w-full",
              isSubtotalGroup &&
                !decision &&
                "border-amber-400 dark:border-amber-600"
            )}
          >
            <SelectValue placeholder="選択してください..." />
          </SelectTrigger>
          <SelectContent>
            {canManualLink && (
              <SelectItem value="same_person">
                既存のグループに紐づける
              </SelectItem>
            )}
            <SelectItem value="create_new">新しく登録する</SelectItem>
            <SelectItem value="skip">取り込まない</SelectItem>
          </SelectContent>
        </Select>

        {/* 既存グループ選択（手動紐づけ時） */}
        {decision === "same_person" && canManualLink && (
          <div className="mt-1 ml-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              紐づけ先のグループを選択してください
            </p>
            <Select
              value={selectedExistingId}
              onValueChange={handleExistingGroupChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="既存グループを選択..." />
              </SelectTrigger>
              <SelectContent>
                {allExistingItems.map((existing) => {
                  const isAlreadyMatched =
                    alreadyMatchedExistingIds?.has(existing.id) ?? false
                  return (
                    <SelectItem
                      key={existing.id}
                      value={existing.id}
                      disabled={isAlreadyMatched}
                    >
                      {existing.name}
                      {isAlreadyMatched && " (他で紐づけ済み)"}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>

            {/* ID選択 */}
            {selectedExistingId && (
              <>
                <p className="text-xs text-muted-foreground">
                  どちらに合わせる？
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
              </>
            )}
          </div>
        )}

        {/* 小計項目マッピングエディタ */}
        {showMappingEditor && (
          <SubtotalMappingEditor
            wizard={wizard}
            importSubtotals={importSubtotals!}
            existingSubtotals={selectedExistingSubtotals!}
          />
        )}
      </div>
    </div>
  )
}
