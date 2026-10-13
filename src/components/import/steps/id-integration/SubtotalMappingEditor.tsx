"use client"

import { useMemo } from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"
import { cn } from "@/lib/utils"
import type { SubtotalInfo } from "@/types/examArchive.types"

interface SubtotalMappingEditorProps {
  wizard: UseImportWizardReturn
  importSubtotals: SubtotalInfo[]
  existingSubtotals: SubtotalInfo[]
}

const NEW_MARKER = "__new__"

/**
 * 小計項目レベルの直接マッピングエディタ
 *
 * 「同じグループとして扱う」を選択した場合にのみ表示され、
 * インポート小計項目と既存小計項目の結びつけを制御する。
 */
export function SubtotalMappingEditor({
  wizard,
  importSubtotals,
  existingSubtotals,
}: SubtotalMappingEditorProps) {
  const { updateSubtotalMapping } = wizard
  const currentMappings = useMemo(
    () => wizard.state.idIntegrationConfig.subtotalMappings ?? {},
    [wizard.state.idIntegrationConfig.subtotalMappings]
  )

  // 各インポート項目の解決済みの値（表示用）。取り込み時（importSubtotals.ts）と同じ決まりで、
  // id が一致する既存項目 → 同じ名前の既存項目（いちばん古いもの、他で使っていないもの）→ 新規
  const resolvedValues = useMemo(() => {
    const values: Record<string, string> = {}
    // id で取られる既存項目は、名前で寄せる候補にしない
    const importSubtotalIds = new Set(
      importSubtotals.map((importSub) => importSub.id)
    )
    const usedIds = new Set(
      importSubtotals.flatMap((importSub) => {
        const mapped = currentMappings[importSub.id]
        return mapped && mapped !== NEW_MARKER ? [mapped] : []
      })
    )
    for (const importSub of importSubtotals) {
      const mapped = currentMappings[importSub.id]
      if (mapped) {
        values[importSub.id] = mapped
        continue
      }
      const sameId = existingSubtotals.find(
        (existingSub) => existingSub.id === importSub.id
      )
      const sameName = existingSubtotals
        .filter(
          (existingSub) =>
            existingSub.name === importSub.name &&
            !usedIds.has(existingSub.id) &&
            !importSubtotalIds.has(existingSub.id)
        )
        .toSorted(
          (left, right) =>
            Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
            (left.id < right.id ? -1 : 1)
        )[0]
      const existingId = (sameId ?? sameName)?.id
      if (existingId) usedIds.add(existingId)
      values[importSub.id] = existingId ?? NEW_MARKER
    }
    return values
  }, [importSubtotals, existingSubtotals, currentMappings])

  // 同じ名前の項目が並ぶときは、並び順（何番目か）を添えて見分ける
  const existingNameCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const existingSub of existingSubtotals) {
      counts.set(existingSub.name, (counts.get(existingSub.name) ?? 0) + 1)
    }
    return counts
  }, [existingSubtotals])
  const existingLabelOf = (existingSub: SubtotalInfo): string =>
    (existingNameCounts.get(existingSub.name) ?? 0) > 1
      ? `${existingSub.name}（${existingSubtotals.indexOf(existingSub) + 1}番目）`
      : existingSub.name

  // 既に選択済みの既存IDを追跡（重複防止）
  const usedExistingIds = useMemo(() => {
    const used = new Set<string>()
    for (const value of Object.values(resolvedValues)) {
      if (value !== NEW_MARKER) {
        used.add(value)
      }
    }
    return used
  }, [resolvedValues])

  return (
    <div className="mt-3 rounded border p-3">
      <div className="mb-2 text-xs font-medium text-muted-foreground">
        小計項目の結びつけ
      </div>
      <div className="space-y-2">
        {importSubtotals.map((importSub) => {
          const currentValue = resolvedValues[importSub.id]
          const isAutoMatch =
            !currentMappings[importSub.id] && currentValue !== NEW_MARKER

          return (
            <div key={importSub.id} className="flex items-center gap-2">
              <span className="w-1/3 truncate text-sm font-medium">
                {importSub.name}
              </span>
              <span className="text-sm text-muted-foreground">→</span>
              <div className="flex-1">
                <Select
                  value={currentValue}
                  onValueChange={(value) => {
                    updateSubtotalMapping(importSub.id, value)
                  }}
                >
                  <SelectTrigger
                    className={cn(
                      "w-full text-sm",
                      isAutoMatch && "border-green-300 dark:border-green-700"
                    )}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {existingSubtotals.map((existingSub) => {
                      const isUsedByOther =
                        usedExistingIds.has(existingSub.id) &&
                        currentValue !== existingSub.id
                      const isAutoTarget =
                        isAutoMatch && currentValue === existingSub.id
                      return (
                        <SelectItem
                          key={existingSub.id}
                          value={existingSub.id}
                          disabled={isUsedByOther}
                        >
                          {existingLabelOf(existingSub)}
                          {isAutoTarget && " (自動一致)"}
                          {isUsedByOther && " (使用済み)"}
                        </SelectItem>
                      )
                    })}
                    <SelectItem value={NEW_MARKER}>+ 新規作成</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
