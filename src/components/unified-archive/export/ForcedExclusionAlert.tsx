"use client"

import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"

import { archiveTableLabel } from "../archiveTableLabels"
import {
  type ArchiveEntityCatalog,
  archiveEntityLabel,
} from "./archiveEntityCatalog"
import { describeScopeViolations } from "./archiveExportSelection"

interface ForcedExclusionAlertProps {
  /** 下見が返した、外せない参照先を外していた行 */
  violations: readonly { target: string }[]
  catalog: ArchiveEntityCatalog
  onRestore: () => void
}

/**
 * 成績算出が使う試験・資料などを「含めない」にしていたときの帯。
 *
 * 外したあとで、それを使う成績算出を足したときに起きる。どれが原因かを名前で出し、
 * 含める側へ戻せるようにする。
 */
export function ForcedExclusionAlert({
  violations,
  catalog,
  onRestore,
}: ForcedExclusionAlertProps) {
  const { targets, unnamedCount } = describeScopeViolations(violations)

  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="flex-1 space-y-2">
          <p className="font-medium text-destructive">
            成績算出が使うものを「含めない」にしているため、書き出せません
          </p>
          <ul className="list-disc pl-5 text-destructive/80">
            {targets.map((target) => (
              <li key={`${target.kind}:${target.id}`}>
                {archiveTableLabel(target.kind)}『
                {archiveEntityLabel(catalog, target.kind, target.id)}』
              </li>
            ))}
            {unnamedCount > 0 && (
              <li>
                含めない試験・資料・小計グループの中の項目 {unnamedCount}件
              </li>
            )}
          </ul>
          <Button type="button" size="sm" variant="outline" onClick={onRestore}>
            含める側へ戻す
          </Button>
        </div>
      </div>
    </div>
  )
}
