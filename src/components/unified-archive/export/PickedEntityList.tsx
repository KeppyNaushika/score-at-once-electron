"use client"

import { X } from "lucide-react"
import { useMemo } from "react"

import { Combobox } from "@/components/common/Combobox"
import { Button } from "@/components/ui/button"

import { archiveTableLabel } from "../archiveTableLabels"
import {
  type ArchiveEntityCatalog,
  archiveEntityLabel,
} from "./archiveEntityCatalog"
import type { ArchiveSelectableKind } from "./types"

interface PickedEntityListProps {
  kind: ArchiveSelectableKind
  pickedIds: readonly string[]
  catalog: ArchiveEntityCatalog
  onPick: (id: string) => void
  onUnpick: (id: string) => void
}

/**
 * 1つの種について、選んだ実体の一覧と、1件ずつ足す Combobox。
 *
 * Combobox は単一選択なので、選んだら一覧に積み、Combobox 自体は未選択に戻す。
 */
export function PickedEntityList({
  kind,
  pickedIds,
  catalog,
  onPick,
  onUnpick,
}: PickedEntityListProps) {
  const kindLabel = archiveTableLabel(kind)

  const addableOptions = useMemo(() => {
    const pickedIdSet = new Set(pickedIds)
    return [...catalog[kind].values()].filter(
      (option) => !pickedIdSet.has(option.value)
    )
  }, [catalog, kind, pickedIds])

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          {kindLabel}
          {pickedIds.length > 0 && (
            <span className="ml-1 text-muted-foreground">
              {pickedIds.length}件
            </span>
          )}
        </span>
        <Combobox
          options={addableOptions}
          value=""
          onValueChange={onPick}
          placeholder={`${kindLabel}を足す`}
          searchPlaceholder={`${kindLabel}を探す`}
          emptyText={`足せる${kindLabel}がありません`}
          aria-label={`${kindLabel}を足す`}
          className="h-8 w-44 text-xs"
        />
      </div>
      {pickedIds.length > 0 && (
        <ul
          aria-label={`選んだ${kindLabel}`}
          className="flex max-h-28 flex-wrap gap-1 overflow-y-auto"
        >
          {pickedIds.map((id) => {
            const entityLabel = archiveEntityLabel(catalog, kind, id)
            return (
              <li
                key={id}
                className="flex items-center gap-1 rounded-md bg-muted py-0.5 pr-0.5 pl-2 text-xs"
              >
                <span className="max-w-48 truncate">{entityLabel}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-5"
                  aria-label={`${entityLabel}を選んだ${kindLabel}から外す`}
                  onClick={() => onUnpick(id)}
                >
                  <X className="size-3" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
