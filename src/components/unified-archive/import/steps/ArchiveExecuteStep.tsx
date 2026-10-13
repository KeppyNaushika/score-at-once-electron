"use client"

import { TriangleAlert } from "lucide-react"

import {
  ImportExecutingView,
  ImportFailedView,
  ImportSucceededHeading,
} from "@/components/import/ImportExecuteStatus"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import type { UnifiedArchiveImportWizardState } from "../hooks/useUnifiedArchiveImportWizard"

/** 6. 実行と結果（作った・置き換えた件数、写した画像・写せなかった画像） */
export function ArchiveExecuteStep({
  wizard,
  onClose,
}: {
  wizard: UnifiedArchiveImportWizardState
  onClose: () => void
}) {
  // 実行の段の結果だけで出し分ける（ウィザード全体のエラーの帯は見ない。✕ で消しても変わらない）
  const { importOutcome, isProcessing } = wizard

  if (isProcessing || importOutcome === null) {
    return <ImportExecutingView />
  }

  if (importOutcome.kind === "failed") {
    return <ImportFailedView error={importOutcome.error} onClose={onClose} />
  }

  const { result, files } = importOutcome
  const totals = Object.values(result.counts).reduce(
    (acc, tableCounts) => ({
      created: acc.created + tableCounts.created,
      replaced: acc.replaced + tableCounts.replaced,
    }),
    { created: 0, replaced: 0 }
  )
  const summaryItems = [
    { label: "新しく作った行", count: totals.created },
    { label: "置き換えた行", count: totals.replaced },
    {
      label: "写した画像",
      count: files.copied.length + files.replaced.length,
    },
    { label: "写せなかった画像", count: files.failed.length },
  ]

  return (
    <div className="flex h-full flex-col items-center justify-center py-8">
      <ImportSucceededHeading />

      <Card className="mb-6 w-full max-w-md border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
        <CardContent className="grid grid-cols-4 gap-4 p-5 text-center">
          {summaryItems.map((summaryItem) => (
            <div key={summaryItem.label}>
              <div className="text-2xl font-bold text-green-600 tabular-nums dark:text-green-400">
                {summaryItem.count}
              </div>
              <div className="text-xs text-green-600/80 dark:text-green-400/80">
                {summaryItem.label}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {files.failed.length > 0 && (
        <Card className="mb-6 w-full max-w-md border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardContent className="flex items-start gap-3 p-5">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0">
              <h4 className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                写せなかった画像
              </h4>
              <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-300">
                {files.failed.map((failedFile) => (
                  <li key={failedFile.path} className="break-all">
                    {failedFile.path}: {failedFile.message}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      <Button onClick={onClose} size="lg" className="px-8">
        閉じる
      </Button>
    </div>
  )
}
