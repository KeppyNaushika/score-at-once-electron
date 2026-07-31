"use client"

import { cn } from "@/lib/utils"
import type { SubtotalInfo } from "@/types/examArchive.types"

interface SubtotalPreviewProps {
  importSubtotals?: SubtotalInfo[]
  existingSubtotals?: SubtotalInfo[]
}

/**
 * 小計グループ配下の小計項目プレビュー（Collapsible内に表示）
 */
export function SubtotalPreview({
  importSubtotals,
  existingSubtotals,
}: SubtotalPreviewProps) {
  if (!importSubtotals?.length && !existingSubtotals?.length) return null

  const importNames = new Set(
    importSubtotals?.map((subtotal) => subtotal.name) ?? []
  )
  const existingNames = new Set(
    existingSubtotals?.map((subtotal) => subtotal.name) ?? []
  )

  return (
    <div className="mt-2 grid grid-cols-2 gap-3 rounded border p-2 text-xs">
      <div>
        <div className="mb-1 font-medium text-muted-foreground">
          ファイルの小計項目
        </div>
        {importSubtotals?.length ? (
          <ul className="space-y-0.5">
            {importSubtotals.map((subtotal) => (
              <li
                key={`${subtotal.name}-${subtotal.order}`}
                className={cn(
                  "rounded px-1.5 py-0.5",
                  existingNames.has(subtotal.name)
                    ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                )}
              >
                {subtotal.name}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-muted-foreground">なし</span>
        )}
      </div>
      <div>
        <div className="mb-1 font-medium text-muted-foreground">
          このPCの小計項目
        </div>
        {existingSubtotals?.length ? (
          <ul className="space-y-0.5">
            {existingSubtotals.map((subtotal) => (
              <li
                key={`${subtotal.name}-${subtotal.order}`}
                className={cn(
                  "rounded px-1.5 py-0.5",
                  importNames.has(subtotal.name)
                    ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                    : "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                )}
              >
                {subtotal.name}
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-muted-foreground">なし</span>
        )}
      </div>
    </div>
  )
}
