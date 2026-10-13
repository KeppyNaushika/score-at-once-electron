"use client"

import { useState } from "react"

import { Combobox } from "@/components/common/Combobox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  matchRowDetail,
  matchRowKeywords,
  matchRowLabel,
} from "@/lib/matchRowText"
import { cn } from "@/lib/utils"
import type {
  ExistingItemInfo,
  IdChoice,
  IdIntegrationDecision,
} from "@/types/examArchive.types"

import type { IdIntegrationRow } from "../../idIntegrationRows"
import { IdChoiceSelect } from "./IdChoiceSelect"
import { ItemRowHeader } from "./ItemRowHeader"
import { SubtotalMappingEditor } from "./SubtotalMappingEditor"
import { SubtotalPreview } from "./SubtotalPreview"
import type { EntityType, IntegrationItemRowProps } from "./types"
import { ENTITY_LABELS, ENTITY_TABLES, isDecisionType } from "./types"

/** 照合の一覧の種類 → 見出しに添える理由 */
const MATCH_LIST_REASONS: Record<
  IdIntegrationRow["matches"][number]["listKey"],
  Record<EntityType, string>
> = {
  byStudentNumber: {
    student: "学籍番号が一致",
    classroom: "学籍番号が一致",
    subtotalGroup: "学籍番号が一致",
  },
  byName: {
    student: "氏名が一致",
    classroom: "学級名が一致",
    subtotalGroup: "グループ名が一致",
  },
}

/**
 * ID統合の1行（id で一致しなかった生徒・学級・小計グループ）。
 *
 * - 見出しに取り込む側の呼び名と見分ける材料（読み・入学年度・所属学級、学級のコード・人数など）
 * - 「同じもの」では紐づけ先を選ぶ。照合の候補を先に、それ以外の既存の行も選べる
 *   （他の行が紐づけ先にしている既存の行は選べない）。選んだ既存の行の見分ける材料も並べる
 * - 同じものにするときは、id をこのPC／ファイルのどちらに合わせるかを選ぶ
 */
export function IntegrationItemRow({
  row,
  entityType,
  requiresChoice,
  allExistingItems,
  existingRowsById,
  claimedExistingIds,
  onDecisionChange,
  wizard,
}: IntegrationItemRowProps) {
  const [showPreview, setShowPreview] = useState(false)
  // 「同じもの」を選んだが紐づけ先がまだ無いとき（照合の候補が無い行）
  const [pendingSamePerson, setPendingSamePerson] = useState(false)

  const table = ENTITY_TABLES[entityType]
  const labels = ENTITY_LABELS[entityType]
  const { decision } = row
  const selectedKind =
    decision.decisionType === "same_person" || pendingSamePerson
      ? "same_person"
      : requiresChoice
        ? ""
        : decision.decisionType
  const selectedExistingId =
    decision.decisionType === "same_person" ? (decision.existingId ?? "") : ""
  const idChoice: IdChoice = decision.idChoice ?? "use_existing_id"

  const describe = (rowData: Record<string, unknown>) => {
    const label = matchRowLabel(table, rowData)
    const detail = matchRowDetail(table, rowData)
    return detail ? `${label}・${detail}` : label
  }
  const importDetail = matchRowDetail(table, row.importData)
  const matchSummary =
    row.matches.length > 0
      ? row.matches
          .map(
            ({ listKey, matchedItem }) =>
              `${MATCH_LIST_REASONS[listKey][entityType]}${
                matchedItem.candidates.length > 1
                  ? `（候補${matchedItem.candidates.length}件）`
                  : ""
              }`
          )
          .join("・")
      : labels.noData

  const candidateIds = new Set(
    row.candidates.map((candidate) => candidate.existingId)
  )
  const toOption = (
    existingId: string,
    existingData: Record<string, unknown>
  ) => {
    const claimed =
      claimedExistingIds.get(existingId) !== undefined &&
      claimedExistingIds.get(existingId) !== row.importId
    const label = describe(existingData)
    return {
      value: existingId,
      label: claimed ? `${label}（他で紐づけ済み）` : label,
      keywords: matchRowKeywords(table, existingData),
      disabled: claimed,
    }
  }
  const existingOptions = [
    ...row.candidates.map((candidate) =>
      toOption(candidate.existingId, candidate.existingData)
    ),
    ...(allExistingItems ?? [])
      .filter((existingItem) => !candidateIds.has(existingItem.id))
      .map((existingItem: ExistingItemInfo) =>
        toOption(existingItem.id, existingItem.existingData)
      ),
  ]
  const selectedExistingRow = selectedExistingId
    ? existingRowsById.get(selectedExistingId)
    : undefined
  const selectedExistingSubtotals = (allExistingItems ?? []).find(
    (existingItem) => existingItem.id === selectedExistingId
  )?.subtotals

  const sendDecision = (next: IdIntegrationDecision) => {
    setPendingSamePerson(false)
    onDecisionChange(next)
  }
  const clearSubtotalMappings = () => {
    if (wizard && row.importSubtotals) {
      wizard.clearSubtotalMappings(
        row.importSubtotals.map((subtotal) => subtotal.id)
      )
    }
  }

  const handleKindChange = (value: string) => {
    if (!isDecisionType(value)) return
    if (value !== "same_person") {
      sendDecision({ importId: row.importId, decisionType: value })
      return
    }
    const firstCandidate = row.candidates.find(
      (candidate) =>
        claimedExistingIds.get(candidate.existingId) === undefined ||
        claimedExistingIds.get(candidate.existingId) === row.importId
    )
    if (firstCandidate) {
      sendDecision({
        importId: row.importId,
        decisionType: "same_person",
        existingId: firstCandidate.existingId,
        idChoice,
      })
    } else {
      setPendingSamePerson(true)
    }
  }

  const handleExistingChange = (existingId: string) => {
    sendDecision({
      importId: row.importId,
      decisionType: "same_person",
      existingId,
      idChoice,
    })
    clearSubtotalMappings()
  }

  const handleIdChoiceChange = (nextIdChoice: IdChoice) => {
    if (!selectedExistingId) return
    sendDecision({
      importId: row.importId,
      decisionType: "same_person",
      existingId: selectedExistingId,
      idChoice: nextIdChoice,
    })
  }

  const hasSubtotalPreview =
    entityType === "subtotalGroup" && !!row.importSubtotals?.length
  const showMappingEditor =
    entityType === "subtotalGroup" &&
    selectedKind === "same_person" &&
    !!wizard &&
    !!row.importSubtotals?.length &&
    !!selectedExistingSubtotals?.length

  return (
    <div className="rounded-lg border p-3">
      <ItemRowHeader
        displayLabel={matchRowLabel(table, row.importData) || row.displayLabel}
        detail={importDetail}
        matchSummary={matchSummary}
        hasSubtotalPreview={hasSubtotalPreview}
        showPreview={showPreview}
        onTogglePreview={() => setShowPreview((shown) => !shown)}
      />

      {hasSubtotalPreview && showPreview && (
        <SubtotalPreview
          importSubtotals={row.importSubtotals}
          existingSubtotals={
            selectedKind === "same_person"
              ? selectedExistingSubtotals
              : undefined
          }
        />
      )}

      <div className="flex flex-col gap-2">
        <Select
          value={selectedKind || undefined}
          onValueChange={handleKindChange}
        >
          <SelectTrigger
            className={cn(
              "w-full",
              selectedKind === "" && "border-amber-400 dark:border-amber-600"
            )}
            aria-label={`${row.displayLabel}の扱い`}
          >
            <SelectValue placeholder="選択してください..." />
          </SelectTrigger>
          <SelectContent>
            {existingOptions.length > 0 && (
              <SelectItem value="same_person">{labels.samePerson}</SelectItem>
            )}
            <SelectItem value="create_new">{labels.createNew}</SelectItem>
            <SelectItem value="skip">{labels.skip}</SelectItem>
          </SelectContent>
        </Select>

        {selectedKind === "same_person" && (
          <div className="mt-1 ml-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              紐づけ先（照合で当たったものが先頭です）
            </p>
            <Combobox
              options={existingOptions}
              value={selectedExistingId}
              onValueChange={handleExistingChange}
              placeholder="紐づけ先を選択"
              searchPlaceholder={labels.searchPlaceholder}
              emptyText="該当するものがありません"
              aria-label={`${row.displayLabel}の紐づけ先`}
              className="w-full"
            />
            {selectedExistingRow && (
              <p className="text-xs text-muted-foreground">
                このPC: {describe(selectedExistingRow)}
              </p>
            )}

            {selectedExistingId && (
              <>
                <p className="text-xs text-muted-foreground">
                  {labels.idChoiceLabel}
                </p>
                <IdChoiceSelect
                  idChoice={idChoice}
                  onIdChoiceChange={handleIdChoiceChange}
                />
              </>
            )}
          </div>
        )}

        {showMappingEditor &&
          wizard &&
          row.importSubtotals &&
          selectedExistingSubtotals && (
            <SubtotalMappingEditor
              wizard={wizard}
              importSubtotals={row.importSubtotals}
              existingSubtotals={selectedExistingSubtotals}
            />
          )}
      </div>
    </div>
  )
}
