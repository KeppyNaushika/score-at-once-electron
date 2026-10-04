"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import type { UnifiedArchiveExportPreview } from "@/electron-src/lib/export/unified-archive/archiveExportPreview"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"
import { unifiedArchiveExportPreviewQuery } from "@/queries/unifiedArchive"

import {
  type ArchiveExportPreviewOk,
  createArchiveEntityRowStateLookup,
  selectionWithoutRow,
} from "../archiveEntityRows"
import {
  parseScopeViolationTarget,
  toArchiveSelection,
} from "../archiveExportSelection"
import { MAJOR_TABLES } from "../exportLabels"
import {
  type ActiveArchiveEntity,
  ARCHIVE_ENTITY_KINDS,
  type ExportSelectionState,
} from "../types"

/** 今いる行が変わってから、外した選択の下見を引くまでの待ち時間（ms） */
const REMOVAL_PREVIEW_DELAY_MS = 200

/**
 * 外した選択の下見を覚えておく時間。同じ行へ戻ったときに引き直さないためのもので、
 * 選択が変わったら呼び出し側がまとめて捨てる（`unifiedArchiveExportPreviewKey`）
 */
const REMOVAL_PREVIEW_CACHE_MS = 10 * 60 * 1000

/** 赤枠の代わりに件数で出す表から除く表（一覧に名前で並ぶ実体の表） */
const LISTED_ENTITY_TABLES: ReadonlySet<string> = new Set(ARCHIVE_ENTITY_KINDS)

/** 並べる順: 主な表を先に、残りは下見の並びのまま */
const tableOrder = (table: string): number => {
  const majorIndex = MAJOR_TABLES.indexOf(table)
  return majorIndex === -1 ? MAJOR_TABLES.length : majorIndex
}

interface UseRemovalImpactOptions {
  selection: ExportSelectionState
  currentUserId: string
  /** チェック一覧で今いる行。一覧から離れていれば null */
  activeEntity: ActiveArchiveEntity | null
  /** 今の選択に対する下見。引き直している最中・ok でないときは null */
  currentPreview: ArchiveExportPreviewOk | null
}

/**
 * チェックの入った行に当てたとき、その1つを外すと一緒に外れるもの。
 *
 * 外した選択で下見をもう1回引き、今の下見と比べる。今いる行が変わってから少し待って引き、
 * 引いている間・外せない行・チェックの無い行では null を返す（古い結果を出さない）。
 *
 * @returns 一緒に外れる実体（`${種}:${id}`。その行自身は除く）と、一覧に出ない表の減る件数。
 *   外すと外せないものが外れるときは、それを使う成績算出の id
 */
export function useRemovalImpact({
  selection,
  currentUserId,
  activeEntity,
  currentPreview,
}: UseRemovalImpactOptions) {
  const removalSelection = useMemo(() => {
    if (activeEntity === null || currentPreview === null) return null
    const rowState = createArchiveEntityRowStateLookup(
      selection,
      currentPreview,
      activeEntity.kind
    )(activeEntity.entityId)
    const selectionWithout = selectionWithoutRow(
      selection,
      activeEntity.kind,
      activeEntity.entityId,
      rowState
    )
    return selectionWithout === null
      ? null
      : toArchiveSelection(selectionWithout, currentUserId)
  }, [selection, currentUserId, activeEntity, currentPreview])

  const debouncedRemovalSelection = useDebouncedValue(
    removalSelection,
    REMOVAL_PREVIEW_DELAY_MS
  )
  const isSettled =
    removalSelection !== null && debouncedRemovalSelection === removalSelection
  const removalPreview = useQuery({
    ...unifiedArchiveExportPreviewQuery(
      isSettled ? debouncedRemovalSelection : null
    ),
    // 同じ「選択 ＋ 外す行」の組なら引き直さない（DB は書かないので、選択が同じ間は変わらない）
    staleTime: Infinity,
    gcTime: REMOVAL_PREVIEW_CACHE_MS,
  })

  const removalResult = isSettled ? removalPreview.data : undefined
  return useMemo(
    () =>
      removalResult === undefined ||
      activeEntity === null ||
      currentPreview === null
        ? null
        : compareRemovalPreview(currentPreview, removalResult, activeEntity),
    [removalResult, activeEntity, currentPreview]
  )
}

/** 今の下見と、今いる行を外した下見を比べる */
function compareRemovalPreview(
  currentPreview: ArchiveExportPreviewOk,
  removalResult: UnifiedArchiveExportPreview,
  activeEntity: ActiveArchiveEntity
) {
  if (removalResult.kind === "forcedExcluded") {
    const gradeIds = new Set(
      removalResult.violations.flatMap((violation) => {
        const target = parseScopeViolationTarget(violation.target)
        return target === null
          ? []
          : (currentPreview.forcedBy[`${target.table}:${target.id}`] ?? [])
      })
    )
    return {
      activeEntity,
      kind: "forcedExcluded" as const,
      gradeIds: [...gradeIds],
    }
  }

  const activeEntityKey = `${activeEntity.kind}:${activeEntity.entityId}`
  const lostEntityKeys = new Set(
    ARCHIVE_ENTITY_KINDS.flatMap((kind) => {
      const remainingIds = new Set(removalResult.entityIds[kind])
      return currentPreview.entityIds[kind]
        .filter((id) => !remainingIds.has(id))
        .map((id) => `${kind}:${id}`)
        .filter((entityKey) => entityKey !== activeEntityKey)
    })
  )
  const lostRowCounts = Object.entries(currentPreview.rowCounts)
    .filter(([table]) => !LISTED_ENTITY_TABLES.has(table))
    .map(
      ([table, rowCount]) =>
        [table, rowCount - (removalResult.rowCounts[table] ?? 0)] as const
    )
    .filter(([, lostCount]) => lostCount > 0)
    .sort(
      ([leftTable], [rightTable]) =>
        tableOrder(leftTable) - tableOrder(rightTable)
    )

  return {
    activeEntity,
    kind: "lost" as const,
    lostEntityKeys,
    lostRowCounts,
  }
}
