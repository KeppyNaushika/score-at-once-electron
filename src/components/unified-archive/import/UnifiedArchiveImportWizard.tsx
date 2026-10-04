"use client"

import { AlertCircle, ChevronLeft, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import { useUnifiedArchiveImportWizard } from "./hooks/useUnifiedArchiveImportWizard"
import { ArchiveConfirmStep } from "./steps/ArchiveConfirmStep"
import { ArchiveConflictStep } from "./steps/ArchiveConflictStep"
import { ArchiveExecuteStep } from "./steps/ArchiveExecuteStep"
import { ArchiveFileSelectStep } from "./steps/ArchiveFileSelectStep"
import { ArchiveMatchStep } from "./steps/ArchiveMatchStep"
import { ArchiveOverviewStep } from "./steps/ArchiveOverviewStep"
import type { OpenedUnifiedArchive, RejectedUnifiedArchive } from "./types"
import { WizardStepIndicator } from "./WizardStepIndicator"

interface UnifiedArchiveImportWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 取り込みに成功したとき */
  onComplete?: () => void
  /** 一覧の「読み込み」で選んだファイルを開いた結果。ここから始める（ファイル選択の段を飛ばす） */
  startWith?: OpenedUnifiedArchive | RejectedUnifiedArchive
}

/**
 * 統合アーカイブ（.sao）の取り込みウィザード（設計 docs/unified-archive-design.md §7.1）。
 *
 * ファイル選択 → 内容確認（方針を選ぶ）→ 紐づけ → 一意制約の衝突 → 確認 → 実行。
 * 試験・資料・成績算出・解答用紙定義・生徒のどの一覧から開いても同じものを取り込む。
 *
 * 開いている間だけ中身をマウントする（閉じれば状態も main の作業も消える）。
 */
export function UnifiedArchiveImportWizard({
  open,
  onOpenChange,
  onComplete,
  startWith,
}: UnifiedArchiveImportWizardProps) {
  if (!open) return null
  return (
    <UnifiedArchiveImportWizardDialog
      onClose={() => onOpenChange(false)}
      onComplete={onComplete}
      startWith={startWith}
    />
  )
}

function UnifiedArchiveImportWizardDialog({
  onClose,
  onComplete,
  startWith,
}: {
  onClose: () => void
  onComplete?: () => void
  startWith?: OpenedUnifiedArchive | RejectedUnifiedArchive
}) {
  const wizard = useUnifiedArchiveImportWizard({ onComplete, startWith })
  const { step, isProcessing, error } = wizard

  const handleClose = () => {
    if (!isProcessing) onClose()
  }

  return (
    <Dialog open onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent className="flex max-h-[90vh] min-w-4xl flex-col gap-0 p-0">
        {/* ヘッダー */}
        <DialogHeader className="border-b bg-muted/30 px-6 py-4">
          <DialogTitle className="text-xl font-semibold">
            統合アーカイブ（.sao）の読み込み
          </DialogTitle>
          <DialogDescription className="sr-only">
            統合アーカイブを開き、紐づけと衝突を確かめてから取り込みます
          </DialogDescription>
          <WizardStepIndicator currentStep={step} />
        </DialogHeader>

        {/* エラー（非中断。閉じずにその場で直せる） */}
        {error && (
          <div
            role="alert"
            className="mx-6 mt-4 rounded-lg border border-destructive/20 bg-destructive/10 p-4"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">エラー</p>
                <p className="mt-1 text-sm text-destructive/80">{error}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={wizard.clearError}
                aria-label="エラーを閉じる"
                className="-mt-2 -mr-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* 段の中身 */}
        <div className="min-h-100 flex-1 overflow-y-auto px-6 py-6">
          {step === "fileSelect" && <ArchiveFileSelectStep wizard={wizard} />}
          {step === "overview" && <ArchiveOverviewStep wizard={wizard} />}
          {step === "match" && <ArchiveMatchStep wizard={wizard} />}
          {step === "conflict" && <ArchiveConflictStep wizard={wizard} />}
          {step === "confirm" && <ArchiveConfirmStep wizard={wizard} />}
          {step === "execute" && (
            <ArchiveExecuteStep wizard={wizard} onClose={handleClose} />
          )}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-between border-t bg-muted/30 px-6 py-4">
          <Button
            variant="ghost"
            onClick={wizard.goBack}
            disabled={
              step === "fileSelect" || step === "execute" || isProcessing
            }
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            戻る
          </Button>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isProcessing}
          >
            {wizard.importOutcome?.kind === "ok" ? "閉じる" : "キャンセル"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
