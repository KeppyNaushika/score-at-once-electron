"use client"

import { archiveTableLabel } from "../archiveTableLabels"
import {
  type ArchiveEntityCatalog,
  archiveEntityLabel,
} from "./archiveEntityCatalog"
import { ARCHIVE_SELECTABLE_KINDS, type ExportSelectionState } from "./types"

interface ExcludedSummaryProps {
  selection: ExportSelectionState
  /** 表名 → 外したことで入らなくなった行の数。下見がまだ無ければ null */
  excludedRowCounts: Readonly<Record<string, number>> | null
  catalog: ArchiveEntityCatalog
}

/**
 * 画面の下に常に出す「含めないもの」。
 *
 * 外した実体の名前と、外したこと（本人分・答案を含めない も含む）で書き出されなくなる行の
 * 数を表ごとに出す。選べる項目は本来関連するものではないので、ここには出さない。
 */
export function ExcludedSummary({
  selection,
  excludedRowCounts,
  catalog,
}: ExcludedSummaryProps) {
  const excludedGroups = ARCHIVE_SELECTABLE_KINDS.flatMap((kind) =>
    selection.excluded[kind].length > 0
      ? [{ kind, ids: selection.excluded[kind] }]
      : []
  )
  const excludedTableCounts = Object.entries(excludedRowCounts ?? {}).filter(
    ([, rowCount]) => rowCount > 0
  )

  if (excludedGroups.length === 0 && excludedTableCounts.length === 0) {
    return (
      <section
        aria-label="含めないもの"
        className="text-sm text-muted-foreground"
      >
        関連するデータを全て含めます
      </section>
    )
  }

  return (
    <section
      aria-label="含めないもの"
      className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300"
    >
      <h3 className="font-semibold">含めないもの</h3>
      {excludedGroups.map((group) => (
        <p key={group.kind}>
          <span className="font-medium">{archiveTableLabel(group.kind)}:</span>{" "}
          {group.ids
            .map((id) => archiveEntityLabel(catalog, group.kind, id))
            .join("、")}
        </p>
      ))}
      {excludedTableCounts.length > 0 && (
        <p>
          <span className="font-medium">書き出されなくなる行:</span>{" "}
          {excludedTableCounts
            .map(
              ([table, rowCount]) => `${archiveTableLabel(table)} ${rowCount}件`
            )
            .join("、")}
        </p>
      )}
    </section>
  )
}
