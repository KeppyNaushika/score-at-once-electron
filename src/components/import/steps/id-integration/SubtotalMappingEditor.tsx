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

  // 既存SubtotalのIDマップ（名前→ID）
  const existingIdByName = useMemo(() => {
    const map = new Map<string, string>()
    for (const existingSub of existingSubtotals) {
      map.set(existingSub.name, existingSub.id)
    }
    return map
  }, [existingSubtotals])

  // 各インポート項目の解決済みの値（表示用）
  const resolvedValues = useMemo(() => {
    const values: Record<string, string> = {}
    for (const importSub of importSubtotals) {
      if (currentMappings[importSub.id]) {
        values[importSub.id] = currentMappings[importSub.id]
      } else {
        // デフォルト: 名前一致する既存項目のID、またはNEW
        const existingId = existingIdByName.get(importSub.name)
        values[importSub.id] = existingId ?? NEW_MARKER
      }
    }
    return values
  }, [importSubtotals, currentMappings, existingIdByName])

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
            !currentMappings[importSub.id] &&
            existingIdByName.has(importSub.name)

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
                      const isNameMatch = existingSub.name === importSub.name
                      return (
                        <SelectItem
                          key={existingSub.id}
                          value={existingSub.id}
                          disabled={isUsedByOther}
                        >
                          {existingSub.name}
                          {isNameMatch && " (自動一致)"}
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
