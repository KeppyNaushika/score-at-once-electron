"use client"

import { useMemo } from "react"

import { cn } from "@/lib/utils"

import {
  type ArchiveEntityCatalog,
  archiveEntityLabel,
} from "./archiveEntityCatalog"
import { ArchiveEntityCheckList } from "./ArchiveEntityCheckList"
import {
  type ArchiveEntityRow,
  type ArchiveExportPreviewOk,
  buildArchiveEntityRows,
} from "./archiveEntityRows"
import {
  ARCHIVE_SELECTABLE_KINDS,
  type ArchiveSelectableKind,
  type ExportSelectionState,
} from "./types"

interface ArchiveEntityCheckListSectionProps {
  selection: ExportSelectionState
  /** 下見（ok のときだけ）。関連で入るか・外せないかはここから決まる */
  preview: ArchiveExportPreviewOk | null
  catalog: ArchiveEntityCatalog
  /** 今いる行を外すと一緒に外れる実体（`${種}:${id}`） */
  lostEntityKeys: ReadonlySet<string>
  onToggle: (kind: ArchiveSelectableKind, row: ArchiveEntityRow) => void
  onActiveEntityChange: (kind: ArchiveSelectableKind, id: string | null) => void
}

/**
 * 書き出すもの。種ごとのチェック一覧と、含まれる利用者（外せない。名前だけ並べる）。
 */
export function ArchiveEntityCheckListSection({
  selection,
  preview,
  catalog,
  lostEntityKeys,
  onToggle,
  onActiveEntityChange,
}: ArchiveEntityCheckListSectionProps) {
  const rowsByKind = useMemo(
    () =>
      ARCHIVE_SELECTABLE_KINDS.map((kind) => ({
        kind,
        rows: buildArchiveEntityRows(kind, catalog, selection, preview),
      })),
    [catalog, selection, preview]
  )
  const userIds = preview?.entityIds.User ?? []

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">書き出すもの</h3>
      <p className="text-xs text-muted-foreground">
        行を選ぶとチェックが入れ替わります（↑↓ で移り、Enter
        で入れ替え）。関連で入るものを外すと「含めない」として残ります。
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {rowsByKind.map(({ kind, rows }) => (
          <ArchiveEntityCheckList
            key={kind}
            kind={kind}
            rows={rows}
            catalog={catalog}
            lostEntityKeys={lostEntityKeys}
            onToggle={(row) => onToggle(kind, row)}
            onActiveIdChange={(id) => onActiveEntityChange(kind, id)}
          />
        ))}
      </div>
      {userIds.length > 0 && (
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">
            含まれる利用者（{userIds.length}人）。パスコードは書き出しません。
          </p>
          <ul aria-label="含まれる利用者" className="flex flex-wrap gap-1">
            {userIds.map((userId) => {
              const isLost = lostEntityKeys.has(`User:${userId}`)
              return (
                <li
                  key={userId}
                  className={cn(
                    "rounded-md bg-muted px-2 py-0.5 text-xs",
                    isLost && "ring-1 ring-destructive ring-inset"
                  )}
                >
                  {archiveEntityLabel(catalog, "User", userId)}
                  {isLost && (
                    <span className="sr-only">外すと一緒に外れます</span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
