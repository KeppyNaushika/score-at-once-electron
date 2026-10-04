"use client"

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"

import type { UnifiedArchiveImportWizardState } from "../hooks/useUnifiedArchiveImportWizard"

/** 6. 実行と結果（作った・置き換えた件数、写した画像・写せなかった画像） */
export function ArchiveExecuteStep({
  wizard,
  onClose,
}: {
  wizard: UnifiedArchiveImportWizardState
  onClose: () => void
}) {
  const { importOutcome, isProcessing, error } = wizard

  if (isProcessing) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-16">
        <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <Spinner className="size-10 text-primary" />
        </div>
        <h3 className="mb-2 text-xl font-semibold">取り込み中...</h3>
        <p className="mb-8 text-muted-foreground">
          データを取り込んでいます。しばらくお待ちください。
        </p>
        <div className="w-full max-w-sm">
          <Progress value={undefined} className="h-2" />
        </div>
      </div>
    )
  }

  if (importOutcome?.kind === "ok") {
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
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-900/30">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="mb-2 text-xl font-semibold">取り込みが完了しました</h3>
        </div>

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
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
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

  return (
    <div className="flex h-full flex-col items-center justify-center py-8">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10">
          <XCircle className="h-10 w-10 text-destructive" />
        </div>
        <h3 className="mb-2 text-xl font-semibold">取り込みに失敗しました</h3>
        <p className="max-w-md text-destructive">{error ?? "詳細は不明です"}</p>
      </div>
      <Button onClick={onClose} variant="outline" size="lg">
        閉じる
      </Button>
    </div>
  )
}
