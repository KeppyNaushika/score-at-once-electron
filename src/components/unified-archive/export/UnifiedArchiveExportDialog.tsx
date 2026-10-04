"use client"

import { useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import type { UnifiedArchiveExportInitialSelection } from "./types"
import { UnifiedArchiveExportPanel } from "./UnifiedArchiveExportPanel"

interface UnifiedArchiveExportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 押した画面の実体。開いたときに最初から入っている */
  initialSelection: UnifiedArchiveExportInitialSelection
}

/**
 * 統合アーカイブ（.sao）の書き出しダイアログ（docs/unified-archive-design.md §6）。
 *
 * 試験・資料・成績算出・解答用紙定義の一覧と詳細、生徒表から、押した画面の実体を
 * 最初から選んだ状態で開く。書き出しの最中は閉じさせない。
 */
export function UnifiedArchiveExportDialog({
  open,
  onOpenChange,
  initialSelection,
}: UnifiedArchiveExportDialogProps) {
  const [isExporting, setIsExporting] = useState(false)

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isExporting) return
        onOpenChange(nextOpen)
      }}
    >
      <DialogContent className="flex max-h-[90vh] min-w-4xl flex-col gap-0 p-0">
        <DialogHeader className="border-b bg-muted/30 px-6 py-4">
          <DialogTitle className="text-xl font-semibold">
            .sao 書き出し
          </DialogTitle>
          <DialogDescription>
            選んだものと、それに関連するデータをまとめて1つのファイルに書き出します。
          </DialogDescription>
        </DialogHeader>
        <UnifiedArchiveExportPanel
          initialSelection={initialSelection}
          onExportingChange={setIsExporting}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
