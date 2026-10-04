"use client"

import { useMemo } from "react"

import {
  ComboboxCheckList,
  type ComboboxCheckOption,
} from "@/components/common/Combobox"

import { archiveTableLabel } from "../archiveTableLabels"
import type { ArchiveEntityCatalog } from "./archiveEntityCatalog"
import {
  type ArchiveEntityRow,
  type ArchiveEntityRowState,
  forcedReasonText,
  isArchiveEntityRowChecked,
} from "./archiveEntityRows"
import type { ArchiveSelectableKind } from "./types"

/** 行の右に出す状態（外せない行は鍵と理由を出すので、ここには載せない） */
const ROW_STATUS_TEXT: Record<ArchiveEntityRowState, string | undefined> = {
  picked: "選択中",
  forced: undefined,
  related: "関連で入る",
  excluded: "含めない",
  notIncluded: undefined,
}

interface ArchiveEntityCheckListProps {
  kind: ArchiveSelectableKind
  rows: readonly ArchiveEntityRow[]
  catalog: ArchiveEntityCatalog
  /** 今いる行を外すと一緒に外れる実体（`${種}:${id}`） */
  lostEntityKeys: ReadonlySet<string>
  onToggle: (row: ArchiveEntityRow) => void
  onActiveIdChange: (id: string | null) => void
}

/**
 * 1つの種の、選んだもの・関連で入るもの・入らないものを1つにまとめたチェック一覧。
 *
 * 行を選ぶとチェックが入れ替わる（入らない → 選ぶ、選んだ → やめる、関連 → 含めない、
 * 含めない → 戻す）。成績算出が使うものは鍵と理由を出し、入れ替えない。
 */
export function ArchiveEntityCheckList({
  kind,
  rows,
  catalog,
  lostEntityKeys,
  onToggle,
  onActiveIdChange,
}: ArchiveEntityCheckListProps) {
  const kindLabel = archiveTableLabel(kind)

  const checkOptions = useMemo(
    () =>
      rows.map((row): ComboboxCheckOption => ({
        ...row.option,
        checked: isArchiveEntityRowChecked(row.state),
        statusText: ROW_STATUS_TEXT[row.state],
        lockedReason:
          row.state === "forced"
            ? forcedReasonText(catalog, row.forcedGradeIds)
            : undefined,
        isStruckOut: row.state === "excluded",
        warningText: lostEntityKeys.has(`${kind}:${row.id}`)
          ? "外すと一緒に外れます"
          : undefined,
      })),
    [rows, catalog, lostEntityKeys, kind]
  )
  const rowById = useMemo(
    () => new Map(rows.map((row) => [row.id, row])),
    [rows]
  )

  const checkedCount = rows.filter((row) =>
    isArchiveEntityRowChecked(row.state)
  ).length
  const excludedCount = rows.filter((row) => row.state === "excluded").length

  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2 text-sm">
        <span className="font-medium">{kindLabel}</span>
        <span className="text-muted-foreground">{checkedCount}件を含める</span>
        {excludedCount > 0 && (
          <span className="text-amber-700 dark:text-amber-400">
            （{excludedCount}件を含めない）
          </span>
        )}
      </div>
      <ComboboxCheckList
        options={checkOptions}
        onCheckedChange={(id) => {
          const row = rowById.get(id)
          if (row) onToggle(row)
        }}
        onActiveValueChange={onActiveIdChange}
        searchPlaceholder={`${kindLabel}を探す`}
        emptyText={`該当する${kindLabel}がありません`}
        aria-label={`${kindLabel}の一覧`}
        listClassName="h-40"
      />
    </div>
  )
}
