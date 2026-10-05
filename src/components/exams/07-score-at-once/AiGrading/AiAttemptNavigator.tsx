"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"

import type { AttemptWithRun } from "./types"

interface AiAttemptNavigatorProps {
  /** この答案の試行（全実行・新しい順） */
  attempts: readonly AttemptWithRun[]
  displayedAttempt: AttemptWithRun
  /** 古い判定へ（`<`） */
  onPrevAttempt: () => void
  /** 新しい判定へ（`>`） */
  onNextAttempt: () => void
}

/** 選んだ答案の試行の見比べ（`<` `>` のボタンと、何番目を見ているか） */
export function AiAttemptNavigator({
  attempts,
  displayedAttempt,
  onPrevAttempt,
  onNextAttempt,
}: AiAttemptNavigatorProps) {
  const displayedIndex = attempts.findIndex(
    (attemptWithRun) =>
      attemptWithRun.attempt.id === displayedAttempt.attempt.id
  )
  return (
    <div className="flex items-center justify-between">
      <Button
        variant="outline"
        size="sm"
        onClick={onPrevAttempt}
        disabled={displayedIndex >= attempts.length - 1}
        aria-label="古い判定"
      >
        <ChevronLeft className="h-4 w-4" />
        <Kbd variant="tiny">&lt;</Kbd>
      </Button>
      <span className="text-xs text-muted-foreground">
        判定 {attempts.length - displayedIndex} / {attempts.length}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={onNextAttempt}
        disabled={displayedIndex <= 0}
        aria-label="新しい判定"
      >
        <Kbd variant="tiny">&gt;</Kbd>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
