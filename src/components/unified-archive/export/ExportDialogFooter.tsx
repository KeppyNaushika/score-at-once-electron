"use client"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type { UnifiedArchiveExportPhase } from "@/electron-src/lib/export/unified-archive/unifiedArchiveCreator"

import { EXPORT_PHASE_LABELS } from "./exportLabels"

interface ExportDialogFooterProps {
  isExporting: boolean
  /** main から届いた書き出しの段。始めたばかりでまだ届いていなければ null */
  exportPhase: UnifiedArchiveExportPhase | null
  /** 下見を引き直している最中か */
  isCheckingScope: boolean
  canExport: boolean
  onCancel: () => void
  onExport: () => void
}

/** 書き出しダイアログの下端: 進み具合と、キャンセル・書き出し */
export function ExportDialogFooter({
  isExporting,
  exportPhase,
  isCheckingScope,
  canExport,
  onCancel,
  onExport,
}: ExportDialogFooterProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-t bg-muted/30 px-6 py-4">
      <p
        aria-live="polite"
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        {isExporting && (
          <>
            <Spinner />
            {exportPhase
              ? EXPORT_PHASE_LABELS[exportPhase]
              : "書き出しています"}
          </>
        )}
        {!isExporting && isCheckingScope && (
          <>
            <Spinner />
            書き出す範囲を確かめています
          </>
        )}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isExporting}>
          キャンセル
        </Button>
        <Button onClick={onExport} disabled={!canExport}>
          書き出し
        </Button>
      </div>
    </div>
  )
}
