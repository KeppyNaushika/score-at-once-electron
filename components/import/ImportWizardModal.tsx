"use client"

import { AlertCircle, Check, ChevronLeft, X } from "lucide-react"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useImportWizard } from "@/hooks/import/useImportWizard"
import { cn } from "@/lib/utils"
import type { ImportWizardStep } from "@/types/projectArchive.types"

import { HszDisclaimerModal } from "./HszDisclaimerModal"
import { ExecuteStep } from "./steps/ExecuteStep"
import { FileOverviewStep } from "./steps/FileOverviewStep"
import { FileSelectStep } from "./steps/FileSelectStep"
import { FinalConfirmStep } from "./steps/FinalConfirmStep"
import { IdIntegrationStep } from "./steps/IdIntegrationStep"
import { UpdateConfirmStep } from "./steps/UpdateConfirmStep"

interface ImportWizardModalProps {
  isOpen: boolean
  onClose: () => void
  onComplete?: (projectId: string) => void
}

const STEP_TITLES: Record<ImportWizardStep, string> = {
  file_select: "ファイル選択",
  file_overview: "内容確認",
  id_integration: "紐づけ",
  update_confirm: "更新",
  final_confirm: "確認",
  execute: "実行",
}

const STEP_ORDER: ImportWizardStep[] = [
  "file_select",
  "file_overview",
  "id_integration",
  "update_confirm",
  "final_confirm",
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

  const currentStepIndex = STEP_ORDER.indexOf(state.currentStep)

  return (
    <>
      <HszDisclaimerModal wizard={wizard} />
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="flex max-h-[90vh] min-w-4xl flex-col gap-0 p-0">
          {/* ヘッダー */}
          <DialogHeader className="bg-muted/30 border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-semibold">
                プロジェクトインポート
              </DialogTitle>
            </div>

            {/* ステップインジケーター */}
            <div className="flex items-center justify-center pt-4">
              {STEP_ORDER.map((step, index) => {
                const isActive = step === state.currentStep
                const isCompleted = index < currentStepIndex

                return (
                  <div key={step} className="flex items-center">
                    {index > 0 && (
                      <div
                        className={cn(
                          "h-0.5 w-8 transition-colors",
                          isCompleted ? "bg-primary" : "bg-muted-foreground/20"
                        )}
                      />
                    )}
                    <div className="flex w-20 flex-col items-center gap-y-2">
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
                        {isCompleted ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-center text-xs font-medium",
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
                <AlertCircle className="text-destructive mt-0.5 h-5 w-5 shrink-0" />
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
          <div className="min-h-100 flex-1 overflow-y-auto px-6 py-6">
            {state.currentStep === "file_select" && (
              <FileSelectStep wizard={wizard} />
            )}
            {state.currentStep === "file_overview" && (
              <FileOverviewStep wizard={wizard} />
            )}
            {state.currentStep === "id_integration" && (
              <IdIntegrationStep wizard={wizard} />
            )}

            {state.currentStep === "update_confirm" && (
              <UpdateConfirmStep wizard={wizard} />
            )}
            {state.currentStep === "final_confirm" && (
              <FinalConfirmStep
                wizard={wizard}
                onExecute={() => wizard.goToNextStep()}
              />
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
              disabled={
                state.currentStep === "file_select" || state.isProcessing
              }
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
    </>
  )
}
