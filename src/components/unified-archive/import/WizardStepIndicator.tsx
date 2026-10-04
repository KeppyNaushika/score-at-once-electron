"use client"

import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

import { ARCHIVE_IMPORT_STEPS, type ArchiveImportStep } from "./types"

const STEP_TITLES: Record<ArchiveImportStep, string> = {
  fileSelect: "ファイル選択",
  overview: "内容確認",
  match: "紐づけ",
  conflict: "衝突",
  confirm: "確認",
  execute: "実行",
}

/** 段の並び（試験の取り込みウィザード ImportWizardModal と同じ見た目） */
export function WizardStepIndicator({
  currentStep,
}: {
  currentStep: ArchiveImportStep
}) {
  const currentStepIndex = ARCHIVE_IMPORT_STEPS.indexOf(currentStep)

  return (
    <ol className="flex items-center justify-center pt-4">
      {ARCHIVE_IMPORT_STEPS.map((step, index) => {
        const isActive = step === currentStep
        const isCompleted = index < currentStepIndex

        return (
          <li
            key={step}
            className="flex items-center"
            aria-current={isActive ? "step" : undefined}
          >
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
                    "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  isCompleted && "bg-primary text-primary-foreground",
                  !isActive && !isCompleted && "bg-muted text-muted-foreground"
                )}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  "text-center text-xs font-medium",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {STEP_TITLES[step]}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
