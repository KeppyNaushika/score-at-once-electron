"use client"

import { SCORING_METHOD_LABELS } from "@/components/exams/07-score-at-once/Rubric/utils/rubricEffectLabel"
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

import type { PendingScaleSwitch } from "../hooks/useScoringMethodChange"

interface ScaleSwitchConfirmDialogProps {
  cropRegionLabel: string
  pending: PendingScaleSwitch | null
  onCancel: () => void
}

/**
 * 類型評価をまたいで方式を変える前の、方式と合わない採点の件数の確認（§4-8-8）。
 * 採点は消さないので、戻せば元の点に戻ることを添える
 */
export function ScaleSwitchConfirmDialog({
  cropRegionLabel,
  pending,
  onCancel,
}: ScaleSwitchConfirmDialogProps) {
  return (
    <AlertDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>採点方式を変えますか</AlertDialogTitle>
          <AlertDialogDescription>
            {pending
              ? `${cropRegionLabel} を「${SCORING_METHOD_LABELS[pending.nextMethod]}」にします。方式と合わない採点が ${pending.incompatibleCount}件あります。採点は消さずに残し、方式を戻せば元の点に戻ります。それまでは点に数えません。`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>やめる</AlertDialogCancel>
          <AlertDialogAction onClick={() => void pending?.proceed()}>
            変える
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
