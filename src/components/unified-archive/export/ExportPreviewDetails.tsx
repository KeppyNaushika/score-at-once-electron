"use client"

import { ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"

import type { UnifiedArchiveMissingFile } from "@/types/unifiedArchive.types"

import { archiveTableLabel } from "../archiveTableLabels"
import { missingFileDescription } from "./exportLabels"

interface ExportPreviewDetailsProps {
  /** 表名 → 範囲に入る行の数 */
  rowCounts: Readonly<Record<string, number>>
  missingFiles: readonly UnifiedArchiveMissingFile[]
}

/** 書き出す前の確認: 折りたたんだ全表の行数と、欠けている画像（主な表の数は「書き出すもの」の右に出す） */
export function ExportPreviewDetails({
  rowCounts,
  missingFiles,
}: ExportPreviewDetailsProps) {
  const [isAllTablesOpen, setIsAllTablesOpen] = useState(false)
  const [isMissingFilesOpen, setIsMissingFilesOpen] = useState(false)

  const allTableCounts = Object.entries(rowCounts)

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">書き出す内容</h3>
      <button
        type="button"
        onClick={() => setIsAllTablesOpen((prev) => !prev)}
        aria-expanded={isAllTablesOpen}
        className="flex items-center gap-1 text-sm text-muted-foreground"
      >
        {isAllTablesOpen ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
        全ての表（{allTableCounts.length}）
      </button>
      {isAllTablesOpen && (
        <dl className="grid max-h-40 grid-cols-3 gap-x-4 gap-y-1 overflow-y-auto rounded-md bg-muted p-2 text-xs">
          {allTableCounts.map(([table, rowCount]) => (
            <div key={table} className="flex justify-between gap-2">
              <dt>{archiveTableLabel(table)}</dt>
              <dd className="tabular-nums">{rowCount}</dd>
            </div>
          ))}
        </dl>
      )}

      {missingFiles.length > 0 && (
        <div className="space-y-1 text-sm">
          <button
            type="button"
            onClick={() => setIsMissingFilesOpen((prev) => !prev)}
            aria-expanded={isMissingFilesOpen}
            className="flex items-center gap-1 font-medium text-orange-600"
          >
            {isMissingFilesOpen ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
            欠けている画像 {missingFiles.length}件（画像なしで書き出します）
          </button>
          {isMissingFilesOpen && (
            // 同じパスが2度来ることは無いが、パスを key にせず改行で並べる（結果の表示と同じ）
            <div className="max-h-32 overflow-y-auto rounded-md bg-muted p-2 font-mono text-xs break-all whitespace-pre-wrap">
              {missingFiles.map(missingFileDescription).join("\n")}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
