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
import { Button } from "@/components/ui/button"
import type { ScoreScaleRow } from "@/queries/scoreScale"

import type { GatedScaleEdit } from "./hooks/useGlobalScaleEditGate"
import { scoreScaleUsageSummary } from "./utils/scoreScaleUsage"

interface GlobalScaleEditConfirmDialogProps {
  scoreScale: ScoreScaleRow
  pendingEdit: GatedScaleEdit | null
  onContinue: () => void
  /** この試験用に複製して直す（03 から開いたときだけ） */
  onDuplicate: (() => Promise<void>) | null
  onCancel: () => void
}

/** 止めている変更の言い方 */
const EDIT_DESCRIPTIONS: Record<GatedScaleEdit["kind"], string> = {
  score: "類型の点数を変える",
  addLevel: "類型を足す",
  deleteLevel: "類型を消す",
}

/**
 * 共通の類型評価の点数・類型を直す前の確認（§4-8-3a）。
 * 使っているすべての試験の点が変わることを、使っている試験・設問の数とともに示す
 */
export function GlobalScaleEditConfirmDialog({
  scoreScale,
  pendingEdit,
  onContinue,
  onDuplicate,
  onCancel,
}: GlobalScaleEditConfirmDialogProps) {
  const usage = scoreScaleUsageSummary(scoreScale)
  return (
    <AlertDialog
      open={pendingEdit !== null}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>共通の類型評価を直しますか</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingEdit
              ? `「${scoreScale.name || "名前なし"}」は ${usage.examCount}試験・${usage.cropRegionCount}設問で使っています。${EDIT_DESCRIPTIONS[pendingEdit.kind]}と、使っているすべての試験の点が変わります（終わった試験の合計や成績算出の結果も変わります。確定した成績の値は変わりません）。`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>やめる</AlertDialogCancel>
          {onDuplicate && (
            <Button variant="outline" onClick={() => void onDuplicate()}>
              この試験用に複製して直す
            </Button>
          )}
          <AlertDialogAction onClick={onContinue}>続けて直す</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
