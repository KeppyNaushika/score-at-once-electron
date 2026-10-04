"use client"

import { ChevronDown, ChevronRight, Lock } from "lucide-react"
import { useState } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

import { archiveTableLabel } from "../archiveTableLabels"
import {
  type ArchiveEntityCatalog,
  archiveEntityLabel,
} from "./archiveEntityCatalog"
import {
  ARCHIVE_SELECTABLE_KINDS,
  type ArchiveEntityKind,
  type ArchiveSelectableKind,
  type ExportSelectionState,
} from "./types"

/** これより多い種は、最初は畳んでおく（生徒は数百人になる） */
const EXPANDED_BY_DEFAULT_LIMIT = 10

interface RelatedEntitiesSectionProps {
  /** 下見が返した、範囲に入る実体の id */
  entityIds: Readonly<Record<ArchiveEntityKind, readonly string[]>>
  /** `${表}:${id}` → それを使うため外せない成績算出の id */
  forcedBy: Readonly<Record<string, readonly string[]>>
  selection: ExportSelectionState
  catalog: ArchiveEntityCatalog
  onExcludedChange: (
    kind: ArchiveSelectableKind,
    id: string,
    isExcluded: boolean
  ) => void
}

/** 1つの種の、関連して入るもの（含める・含めない） */
interface RelatedGroup {
  kind: ArchiveSelectableKind
  includedIds: string[]
  excludedIds: string[]
}

/**
 * 関連して含まれるもの。選んでいない実体を種ごとに、チェック済みで並べる。
 *
 * 外すと `exclusions` に入り、その行は「含めない」として目立つ色で残る（もう一度
 * チェックすれば戻せる）。成績算出が使うものはチェックを固定し、理由を添える。
 */
export function RelatedEntitiesSection({
  entityIds,
  forcedBy,
  selection,
  catalog,
  onExcludedChange,
}: RelatedEntitiesSectionProps) {
  /** 既定の開閉から切り替えた種 */
  const [toggledKinds, setToggledKinds] = useState<
    ReadonlySet<ArchiveSelectableKind>
  >(new Set())

  const groups: RelatedGroup[] = ARCHIVE_SELECTABLE_KINDS.flatMap((kind) => {
    const pickedIdSet = new Set(selection.picked[kind])
    const includedIds = entityIds[kind].filter((id) => !pickedIdSet.has(id))
    const includedIdSet = new Set(includedIds)
    const excludedIds = selection.excluded[kind].filter(
      (id) => !includedIdSet.has(id)
    )
    return includedIds.length + excludedIds.length > 0
      ? [{ kind, includedIds, excludedIds }]
      : []
  })

  const toggleKind = (kind: ArchiveSelectableKind) => {
    setToggledKinds((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) {
        next.delete(kind)
      } else {
        next.add(kind)
      }
      return next
    })
  }

  const forcedReason = (kind: ArchiveSelectableKind, id: string) => {
    const gradeIds = forcedBy[`${kind}:${id}`]
    if (!gradeIds || gradeIds.length === 0) return null
    const gradeNames = gradeIds
      .map((gradeId) => `『${archiveEntityLabel(catalog, "Grade", gradeId)}』`)
      .join("")
    return `成績算出${gradeNames}が使うため`
  }

  const userIds = entityIds.User

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">関連して含まれるもの</h3>
      {groups.length === 0 && userIds.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          選んだもののほかに含まれるものはありません
        </p>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => {
            const kindLabel = archiveTableLabel(group.kind)
            const totalCount =
              group.includedIds.length + group.excludedIds.length
            const isExpanded =
              totalCount <= EXPANDED_BY_DEFAULT_LIMIT !==
              toggledKinds.has(group.kind)
            return (
              <div key={group.kind} className="rounded-md border">
                <button
                  type="button"
                  onClick={() => toggleKind(group.kind)}
                  aria-expanded={isExpanded}
                  className="flex w-full items-center gap-1 px-3 py-2 text-left text-sm"
                >
                  {isExpanded ? (
                    <ChevronDown className="size-4 shrink-0" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0" />
                  )}
                  <span className="font-medium">{kindLabel}</span>
                  <span className="text-muted-foreground">
                    {group.includedIds.length}件
                  </span>
                  {group.excludedIds.length > 0 && (
                    <span className="text-amber-700 dark:text-amber-400">
                      （{group.excludedIds.length}件を含めない）
                    </span>
                  )}
                </button>
                {isExpanded && (
                  <ul
                    aria-label={`関連して含まれる${kindLabel}`}
                    className="max-h-48 space-y-0.5 overflow-y-auto border-t px-3 py-2"
                  >
                    {[...group.includedIds, ...group.excludedIds].map((id) => {
                      const entityLabel = archiveEntityLabel(
                        catalog,
                        group.kind,
                        id
                      )
                      const isExcluded = group.excludedIds.includes(id)
                      const reason = isExcluded
                        ? null
                        : forcedReason(group.kind, id)
                      const checkboxId = `related-${group.kind}-${id}`
                      return (
                        <li
                          key={id}
                          className={cn(
                            "flex items-center gap-2 rounded px-1 py-0.5 text-sm",
                            isExcluded &&
                              "bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300"
                          )}
                        >
                          <Checkbox
                            id={checkboxId}
                            checked={!isExcluded}
                            disabled={reason !== null}
                            onCheckedChange={(checked) =>
                              onExcludedChange(group.kind, id, checked !== true)
                            }
                          />
                          <label
                            htmlFor={checkboxId}
                            className="min-w-0 flex-1 truncate"
                          >
                            {entityLabel}
                          </label>
                          {isExcluded && (
                            <span className="shrink-0 text-xs font-medium">
                              含めない
                            </span>
                          )}
                          {reason !== null && (
                            <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                              <Lock className="size-3" />
                              {reason}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
          {userIds.length > 0 && (
            <p className="px-1 text-sm text-muted-foreground">
              含まれる利用者（{userIds.length}人）:{" "}
              {userIds
                .map((userId) => archiveEntityLabel(catalog, "User", userId))
                .join("、")}
              。パスコードは書き出しません。
            </p>
          )}
        </div>
      )}
    </section>
  )
}
