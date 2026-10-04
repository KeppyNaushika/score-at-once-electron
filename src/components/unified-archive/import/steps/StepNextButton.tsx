"use client"

import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

/** 段の下に置く「次へ」（試験の取り込みウィザードと同じ見た目） */
export function StepNextButton({
  onClick,
  isProcessing,
  disabled = false,
  processingLabel = "確かめています...",
  children = "次へ",
}: {
  onClick: () => void
  isProcessing: boolean
  disabled?: boolean
  processingLabel?: string
  children?: ReactNode
}) {
  return (
    <div className="mt-6 flex justify-center">
      <Button
        onClick={onClick}
        disabled={disabled || isProcessing}
        size="lg"
        className="gap-2 px-8"
      >
        {isProcessing ? (
          <>
            <Spinner />
            {processingLabel}
          </>
        ) : (
          children
        )}
      </Button>
    </div>
  )
}
