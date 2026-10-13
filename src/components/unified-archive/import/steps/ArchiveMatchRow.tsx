"use client"

import { Combobox } from "@/components/common/Combobox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  ArchiveIdChoice,
  ArchiveMatchDecision,
} from "@/electron-src/lib/import/unified-archive/types"
import {
  matchRowDetail,
  matchRowKeywords,
  matchRowLabel,
} from "@/lib/matchRowText"
import type { ImportAction } from "@/types/importAction.types"

import { matchedByLabel } from "../archiveImportLabels"
import type { ArchiveLinkableRow, ArchiveMatchCandidate } from "../types"

type MatchDecisionKind = ArchiveMatchDecision["kind"]

const isMatchDecisionKind = (value: string): value is MatchDecisionKind =>
  value === "same" || value === "new" || value === "skip"

const isArchiveIdChoice = (value: string): value is ArchiveIdChoice =>
  value === "existing" || value === "archive"

/**
 * 紐づけの1行（試験の取り込みの IntegrationItemRow と同じ見た目）。
 *
 * - 同じもの: 紐づけ先を Combobox で選ぶ。照合の候補を先に、候補に無い既存の行も選べる
 *   （他の行が紐づけ先にしている既存の行は選べない）。選んだ既存の行の見分ける材料も並べる。
 *   id は取り込み先 / アーカイブのどちらに合わせるか（別で追加では既存の行に触らないので、
 *   アーカイブに合わせるは出さない）
 * - 新規 / 取り込まない。**利用者には「取り込まない」を出さない**（採点の行が採点者を失う）
 */
export function ArchiveMatchRow({
  matchCandidate,
  linkableRows,
  claimedExistingIds,
  decision,
  action,
  onDecisionChange,
}: {
  matchCandidate: ArchiveMatchCandidate
  /** 候補に無くても手で結べる既存の行 */
  linkableRows: readonly ArchiveLinkableRow[]
  /** 既存の行の id → それを紐づけ先にしているアーカイブの行のキー */
  claimedExistingIds: ReadonlyMap<string, string>
  decision: ArchiveMatchDecision
  action: ImportAction
  onDecisionChange: (decision: ArchiveMatchDecision) => void
}) {
  const { table, archiveRow, candidates, matchedBy } = matchCandidate
  const rowKey = `${table}:${matchCandidate.archiveId}`
  const isClaimedByOther = (existingId: string): boolean => {
    const claimant = claimedExistingIds.get(existingId)
    return claimant !== undefined && claimant !== rowKey
  }
  const candidateIds = new Set(
    candidates.map((candidate) => candidate.existingId)
  )
  const selectableRows = [
    ...candidates,
    ...linkableRows.filter(
      (linkableRow) => !candidateIds.has(linkableRow.existingId)
    ),
  ]
  const firstCandidate = selectableRows.find(
    (selectableRow) => !isClaimedByOther(selectableRow.existingId)
  )
  const archiveLabel = matchRowLabel(table, archiveRow)
  const archiveDetail = matchRowDetail(table, archiveRow)
  const canSkip = table !== "User"
  const canAdoptArchiveId = action !== "separate"
  // 別で追加では送るときに取り込み先の id へ倒すので、見た目もそれに揃える
  const adoptId: ArchiveIdChoice =
    decision.kind === "same" && canAdoptArchiveId
      ? decision.adoptId
      : "existing"

  const handleKindChange = (value: string) => {
    if (!isMatchDecisionKind(value)) return
    if (value === "same") {
      if (!firstCandidate) return
      onDecisionChange({
        kind: "same",
        existingId: firstCandidate.existingId,
        adoptId: "existing",
      })
    } else {
      onDecisionChange({ kind: value })
    }
  }

  const describe = (row: Readonly<Record<string, unknown>>): string => {
    const detail = matchRowDetail(table, row)
    const label = matchRowLabel(table, row)
    return detail ? `${label}・${detail}` : label
  }
  const candidateOptions = selectableRows.map((selectableRow) => {
    const claimed = isClaimedByOther(selectableRow.existingId)
    const label = describe(selectableRow.existingRow)
    return {
      value: selectableRow.existingId,
      label: claimed ? `${label}（他で紐づけ済み）` : label,
      keywords: matchRowKeywords(table, selectableRow.existingRow),
      disabled: claimed,
    }
  })
  const selectedCandidate =
    decision.kind === "same"
      ? selectableRows.find(
          (selectableRow) => selectableRow.existingId === decision.existingId
        )
      : undefined

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-medium">{archiveLabel}</span>
          {archiveDetail && (
            <span className="ml-2 text-xs text-muted-foreground">
              {archiveDetail}
            </span>
          )}
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {matchedByLabel(table, matchedBy)}
          {candidates.length > 1 && `（候補 ${candidates.length}件）`}
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <Select value={decision.kind} onValueChange={handleKindChange}>
          <SelectTrigger
            className="w-full"
            aria-label={`${archiveLabel}の扱い`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {firstCandidate && (
              <SelectItem value="same">同じものとして紐づける</SelectItem>
            )}
            <SelectItem value="new">新しく登録する</SelectItem>
            {canSkip && <SelectItem value="skip">取り込まない</SelectItem>}
          </SelectContent>
        </Select>

        {decision.kind === "same" && (
          <div className="mt-1 ml-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              紐づけ先（照合で当たったものが先頭です）
            </p>
            <Combobox
              options={candidateOptions}
              value={decision.existingId}
              onValueChange={(existingId) =>
                onDecisionChange({ ...decision, existingId })
              }
              placeholder="紐づけ先を選択"
              searchPlaceholder="名前・番号で検索"
              emptyText="該当する候補がありません"
              aria-label={`${archiveLabel}の紐づけ先`}
              className="w-full"
            />
            {selectedCandidate && (
              <p className="text-xs text-muted-foreground">
                このPC: {describe(selectedCandidate.existingRow)}
              </p>
            )}

            {canAdoptArchiveId ? (
              <>
                <p className="text-xs text-muted-foreground">
                  どちらの id に合わせる？
                </p>
                <Select
                  value={adoptId}
                  onValueChange={(value) => {
                    if (isArchiveIdChoice(value)) {
                      onDecisionChange({ ...decision, adoptId: value })
                    }
                  }}
                >
                  <SelectTrigger
                    className="w-full"
                    aria-label={`${archiveLabel}の id`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="existing">
                      このPCの id に合わせる
                    </SelectItem>
                    <SelectItem value="archive">
                      アーカイブの id に合わせる
                    </SelectItem>
                  </SelectContent>
                </Select>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">
                このPCの id に合わせます（別で追加では既存のものに触りません）
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
