"use client"

import { useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useImportWizard } from "@/hooks/import/useImportWizard"
import { FileSelectStep } from "./steps/FileSelectStep"
import { ModeSelectStep } from "./steps/ModeSelectStep"
import { MatchingConfigStep } from "./steps/MatchingConfigStep"
import { ConflictResolveStep } from "./steps/ConflictResolveStep"
import { ExecuteStep } from "./steps/ExecuteStep"
import type { ImportWizardStep } from "@/types/project-archive.types"
import { ChevronLeft, X, AlertCircle, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface ImportWizardModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete?: (projectId: string) => void
}

const STEP_TITLES: Record<ImportWizardStep, string> = {
  file_select: "ファイル選択",
  mode_select: "インポートモード",
  matching_config: "マッチング設定",
  conflict_resolve: "競合解決",
  execute: "実行",
}

const STEP_ORDER: ImportWizardStep[] = [
  "file_select",
  "mode_select",
  "matching_config",
  "conflict_resolve",
  "execute",
]

export function ImportWizardModal({
  isOpen,
  onClose,
  onComplete,
}: ImportWizardModalProps) {
  const wizard = useImportWizard()
  const { state, reset } = wizard

  // モーダルを閉じたらリセット
  useEffect(() => {
    if (!isOpen) {
      reset()
    }
  }, [isOpen, reset])

  const handleClose = () => {
    if (!state.isProcessing) {
      onClose()
    }
  }

  // 新規作成モードの場合のステップ調整
  const effectiveSteps: ImportWizardStep[] =
    state.mode === "new"
      ? ["file_select", "mode_select", "execute"]
      : STEP_ORDER

  const effectiveStepIndex = effectiveSteps.indexOf(state.currentStep)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-0 p-0">
        {/* ヘッダー */}
        <DialogHeader className="bg-muted/30 border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold">
              プロジェクトインポート
            </DialogTitle>
          </div>

          {/* ステップインジケーター */}
          <div className="flex items-center justify-center gap-1 pt-4">
            {effectiveSteps.map((step, index) => {
              const isActive = step === state.currentStep
              const isCompleted =
                effectiveSteps.indexOf(step) < effectiveStepIndex

              return (
                <div key={step} className="flex items-center">
                  {index > 0 && (
                    <div
                      className={cn(
                        "mx-1 h-0.5 w-12 transition-colors",
                        isCompleted ? "bg-primary" : "bg-muted-foreground/20"
                      )}
                    />
                  )}
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all",
                        isActive &&
                          "bg-primary text-primary-foreground ring-primary/20 ring-4",
                        isCompleted && "bg-primary text-primary-foreground",
                        !isActive &&
                          !isCompleted &&
                          "bg-muted text-muted-foreground"
                      )}
                    >
                      {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                    </div>
                    <span
                      className={cn(
                        "text-xs font-medium whitespace-nowrap",
                        isActive && "text-primary",
                        !isActive && "text-muted-foreground"
                      )}
                    >
                      {STEP_TITLES[step]}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </DialogHeader>

        {/* エラー表示 */}
        {state.error && (
          <div className="bg-destructive/10 border-destructive/20 mx-6 mt-4 rounded-lg border p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="text-destructive mt-0.5 h-5 w-5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-destructive text-sm font-medium">エラー</p>
                <p className="text-destructive/80 mt-1 text-sm">
                  {state.error}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={wizard.clearError}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 -mt-2 -mr-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ステップコンテンツ */}
        <div className="min-h-[400px] flex-1 overflow-y-auto px-6 py-6">
          {state.currentStep === "file_select" && (
            <FileSelectStep wizard={wizard} />
          )}
          {state.currentStep === "mode_select" && (
            <ModeSelectStep wizard={wizard} />
          )}
          {state.currentStep === "matching_config" && (
            <MatchingConfigStep wizard={wizard} />
          )}
          {state.currentStep === "conflict_resolve" && (
            <ConflictResolveStep wizard={wizard} />
          )}
          {state.currentStep === "execute" && (
            <ExecuteStep
              wizard={wizard}
              onComplete={onComplete}
              onClose={onClose}
            />
          )}
        </div>

        {/* フッター */}
        <div className="bg-muted/30 flex items-center justify-between border-t px-6 py-4">
          <Button
            variant="ghost"
            onClick={wizard.goBack}
            disabled={state.currentStep === "file_select" || state.isProcessing}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            戻る
          </Button>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={state.isProcessing}
          >
            キャンセル
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
