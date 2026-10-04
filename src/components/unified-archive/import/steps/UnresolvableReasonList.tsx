"use client"

import { XCircle } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"

import { archiveColumnLabel, archiveTableLabel } from "../../archiveTableLabels"
import { ARCHIVE_UNRESOLVABLE_MESSAGES } from "../archiveImportLabels"
import type { ArchiveUnresolvableReason } from "../types"

/** 解けない衝突の理由を、種類ごとにまとめて見せる。これがある間は取り込めない */
export function UnresolvableReasonList({
  reasons,
}: {
  reasons: readonly ArchiveUnresolvableReason[]
}) {
  const reasonsByKind = new Map<
    ArchiveUnresolvableReason["kind"],
    ArchiveUnresolvableReason[]
  >()
  for (const reason of reasons) {
    reasonsByKind.set(reason.kind, [
      ...(reasonsByKind.get(reason.kind) ?? []),
      reason,
    ])
  }

  return (
    <Card role="alert" className="border-destructive/20 bg-destructive/10">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <p className="text-sm font-medium text-destructive">
            このままでは取り込めません。紐づけか採用する id
            を選び直してください。
          </p>
        </div>
        {[...reasonsByKind].map(([kind, kindReasons]) => (
          <div key={kind} className="ml-8 space-y-1">
            <p className="text-sm text-destructive/90">
              {ARCHIVE_UNRESOLVABLE_MESSAGES[kind]}
            </p>
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-destructive/80">
              {kindReasons.map((reason) => (
                <li
                  key={`${reason.table}:${reason.archiveIds.join(",")}:${reason.existingIds.join(",")}`}
                >
                  {archiveTableLabel(reason.table)}
                  {reason.columns.length > 0 &&
                    `（${reason.columns.map(archiveColumnLabel).join("・")}）`}
                  : 読み込む行 {reason.archiveIds.length}件 / このパソコンの行{" "}
                  {reason.existingIds.length}件
                </li>
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
