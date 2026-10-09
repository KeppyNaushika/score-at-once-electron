"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import type { PendingRubricRecalculation } from "./hooks/useRubricRecalculation"
import type { RubricRecalculationSummary } from "./utils/rubricRecalculation"

interface RubricRecalculationDialogProps {
  pending: PendingRubricRecalculation | null
  onCancel: () => void
}

/** 点が変わる件数の言い方（他の採点者を先に、自分を後に） */
function describeRubricRecalculation(
  summary: RubricRecalculationSummary
): string {
  const parts = [
    summary.otherScoreCount > 0
      ? `他の採点者 ${summary.otherUserCount}名・${summary.otherScoreCount}件`
      : null,
    summary.ownScoreCount > 0 ? `自分の ${summary.ownScoreCount}件` : null,
  ].filter((part) => part !== null)
  return parts.length === 0
    ? "点の変わる答案はありません。"
    : `${parts.join("と、")}の点が変わります。`
}

/** 項目・採点方式を変える前の、点が変わる件数の確認（§4-6） */
export function RubricRecalculationDialog({
  pending,
  onCancel,
}: RubricRecalculationDialogProps) {
  return (
    <AlertDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {pending?.description}
            {pending ? describeRubricRecalculation(pending.summary) : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>やめる</AlertDialogCancel>
          <AlertDialogAction onClick={() => void pending?.proceed()}>
            {pending?.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
