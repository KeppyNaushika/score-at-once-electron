"use client"

import { AlertTriangle, FileArchive, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"

import { ARCHIVE_REJECTION_MESSAGES } from "../archiveImportLabels"
import type { UnifiedArchiveImportWizardState } from "../hooks/useUnifiedArchiveImportWizard"

/** 1. ファイルを選んで開く。開けなかったら理由をその場に出す */
export function ArchiveFileSelectStep({
  wizard,
}: {
  wizard: UnifiedArchiveImportWizardState
}) {
  const { isProcessing, rejection, selectFile } = wizard

  return (
    <div className="flex h-full flex-col items-center justify-center py-8">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-6 flex h-20 w-32 items-center justify-center rounded-2xl bg-primary/10">
          <FileArchive className="h-10 w-10 text-primary" />
        </div>
        <h3 className="mb-2 text-xl font-semibold text-foreground">
          統合アーカイブを選択
        </h3>
        <p className="max-w-lg text-muted-foreground">
          書き出した .sao ファイルを選択してください。
          <br />
          試験・資料・成績算出・解答用紙定義と、それに関わる生徒・学級などをまとめて取り込みます。
        </p>
      </div>

      <Button
        onClick={() => void selectFile()}
        disabled={isProcessing}
        size="lg"
        className="h-12 gap-2 px-8 text-base"
      >
        {isProcessing ? (
          <>
            <Spinner />
            開いています...
          </>
        ) : (
          <>
            <Upload className="h-5 w-5" />
            ファイルを選択
          </>
        )}
      </Button>

      {rejection && (
        <Card
          role="alert"
          className="mt-10 w-full max-w-lg border-destructive/20 bg-destructive/10"
        >
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-destructive">
                このファイルは開けません
              </p>
              <p className="text-sm text-destructive/80">
                {ARCHIVE_REJECTION_MESSAGES[rejection.reason]}
              </p>
              {rejection.details.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-xs text-destructive/70">
                  {rejection.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
