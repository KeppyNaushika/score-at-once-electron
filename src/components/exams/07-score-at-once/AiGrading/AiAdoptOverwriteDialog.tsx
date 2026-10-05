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

interface AiAdoptOverwriteDialogProps {
  /** 上書きを待っている採用（無ければ閉じている） */
  pendingOverwrite: { adoptionCount: number; overwriteCount: number } | null
  onConfirm: () => void
  onCancel: () => void
}

/** 選んだ中に自分が採点済みの答案があるときの、1回だけの上書きの確認 */
export function AiAdoptOverwriteDialog({
  pendingOverwrite,
  onConfirm,
  onCancel,
}: AiAdoptOverwriteDialogProps) {
  return (
    <AlertDialog
      open={pendingOverwrite !== null}
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>自分の採点を上書きしますか</AlertDialogTitle>
          <AlertDialogDescription>
            採用する {pendingOverwrite?.adoptionCount ?? 0} 件のうち{" "}
            {pendingOverwrite?.overwriteCount ?? 0} 件は採点済みです。AI
            の判定で上書きします。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>やめる</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            上書きして採用
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
