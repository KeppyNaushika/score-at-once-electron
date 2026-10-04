"use client"

import { type ReactNode, useMemo } from "react"

import {
  ComboboxCheckList,
  type ComboboxCheckOption,
} from "@/components/common/ComboboxCheckList"

import { archiveTableLabel } from "../archiveTableLabels"
import {
  type ArchiveEntityCatalog,
  archiveEntityLabel,
} from "./archiveEntityCatalog"
import {
  type ArchiveEntityRow,
  type ArchiveEntityRowState,
  forcedReasonText,
  isArchiveEntityRowChecked,
} from "./archiveEntityRows"
import type { useRemovalImpact } from "./hooks/useRemovalImpact"
import type { ArchiveSelectableKind } from "./types"

/** 行の右に出す状態（外せない行は鍵と理由を出すので、ここには載せない） */
const ROW_STATUS_TEXT: Record<ArchiveEntityRowState, string | undefined> = {
  picked: "選択中",
  forced: undefined,
  related: "関連で入る",
  excluded: "含めない",
  notIncluded: undefined,
}

/**
 * 行の右に出す状態。学級から入った生徒は、どの学級から入ったかを添える
 * （例: 選択中（1年1組）・選択中（1年1組ほか））
 */
function rowStatusText(
  catalog: ArchiveEntityCatalog,
  row: ArchiveEntityRow
): string | undefined {
  const [firstClassroomId, ...otherClassroomIds] = row.sourceClassroomIds
  if (firstClassroomId === undefined) return ROW_STATUS_TEXT[row.state]
  const classroomName = archiveEntityLabel(
    catalog,
    "Classroom",
    firstClassroomId
  )
  return `選択中（${classroomName}${otherClassroomIds.length > 0 ? "ほか" : ""}）`
}

/**
 * 当てている行の右端に出す赤字。外すと一緒に外れる実体の数（その行自身は数えない。0 なら
 * 出さない）か、外すと外せないものが外れるときの「外せません」と理由
 */
function removalImpactTexts(
  catalog: ArchiveEntityCatalog,
  removalImpact: ReturnType<typeof useRemovalImpact>,
  rowId: string
): Pick<ComboboxCheckOption, "impactText" | "impactDescription"> {
  if (removalImpact === null || removalImpact.activeEntity.entityId !== rowId) {
    return {}
  }
  if (removalImpact.kind === "forcedExcluded") {
    return {
      impactText: "外せません",
      impactDescription: forcedReasonText(catalog, removalImpact.gradeIds),
    }
  }
  const lostCount = removalImpact.lostEntityKeys.size
  return lostCount > 0 ? { impactText: `${lostCount}件の選択を解除` } : {}
}

interface ArchiveEntityCheckListProps {
  kind: ArchiveSelectableKind
  rows: readonly ArchiveEntityRow[]
  catalog: ArchiveEntityCatalog
  /** 今いる行を外すと一緒に外れる実体（`${種}:${id}`） */
  lostEntityKeys: ReadonlySet<string>
  /** この種の行に当てているときの、その行を外したときの影響（他の種なら null） */
  removalImpact: ReturnType<typeof useRemovalImpact>
  onToggle: (row: ArchiveEntityRow) => void
  /** 見出しの全選択: 今一覧に出ている行にまとめてチェックを当てる */
  onToggleMany: (rows: ArchiveEntityRow[], isChecked: boolean) => void
  onActiveIdChange: (id: string | null) => void
  /** 見出しの種名のすぐ右に出すもの（学級の、生徒を選ぶ範囲の切り替え） */
  headerControls?: ReactNode
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
  removalImpact,
  onToggle,
  onToggleMany,
  onActiveIdChange,
  headerControls,
}: ArchiveEntityCheckListProps) {
  const kindLabel = archiveTableLabel(kind)

  const checkOptions = useMemo(
    () =>
      rows.map((row): ComboboxCheckOption => ({
        ...row.option,
        checked: isArchiveEntityRowChecked(row.state),
        statusText: rowStatusText(catalog, row),
        lockedReason:
          row.state === "forced"
            ? forcedReasonText(catalog, row.forcedGradeIds)
            : undefined,
        isStruckOut: row.state === "excluded",
        warningText: lostEntityKeys.has(`${kind}:${row.id}`)
          ? "外すと一緒に外れます"
          : undefined,
        ...removalImpactTexts(catalog, removalImpact, row.id),
      })),
    [rows, catalog, lostEntityKeys, kind, removalImpact]
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
    <ComboboxCheckList
      header={
        <>
          <span className="text-sm font-medium">{kindLabel}</span>
          {headerControls}
          <span className="text-sm text-muted-foreground">
            {checkedCount}件を含める
          </span>
          {excludedCount > 0 && (
            <span className="text-sm text-amber-700 dark:text-amber-400">
              （{excludedCount}件を含めない）
            </span>
          )}
        </>
      }
      options={checkOptions}
      onCheckedChange={(id) => {
        const row = rowById.get(id)
        if (row) onToggle(row)
      }}
      onCheckedChangeMany={(ids, isChecked) =>
        onToggleMany(
          ids.flatMap((id) => rowById.get(id) ?? []),
          isChecked
        )
      }
      selectAllLabel={`表示中の${kindLabel}を全て選ぶ`}
      onActiveValueChange={onActiveIdChange}
      searchPlaceholder={`${kindLabel}を探す`}
      emptyText={`該当する${kindLabel}がありません`}
      aria-label={`${kindLabel}の一覧`}
      listClassName="h-40"
    />
  )
}
