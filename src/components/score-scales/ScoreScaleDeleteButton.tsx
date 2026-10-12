"use client"

import { useMutation } from "@tanstack/react-query"
import { Trash } from "lucide-react"
import { useState } from "react"

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
import {
  deleteScoreScaleMutation,
  type ScoreScaleRow,
} from "@/queries/scoreScale"

interface ScoreScaleDeleteButtonProps {
  scoreScale: ScoreScaleRow
  onDeleted?: () => void
}

/**
 * 類型表を消すボタンと確認（§4-8-3）。使っている設問があれば消せない
 * （ボタンを止めて件数を示す。押すまでに同期で届いた分は main が数え直して拒む）
 */
export function ScoreScaleDeleteButton({
  scoreScale,
  onDeleted,
}: ScoreScaleDeleteButtonProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { mutateAsync: deleteScoreScale, isPending } = useMutation(
    deleteScoreScaleMutation()
  )
  const usedCount = scoreScale.cropRegions.length

  const confirmDelete = async () => {
    setConfirmOpen(false)
    try {
      await deleteScoreScale(scoreScale.id)
      onDeleted?.()
    } catch {
      // 失敗の通知は MutationCache の後始末が担う
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {usedCount > 0 && (
          <span className="text-xs text-muted-foreground">
            {usedCount}問の設問が使っています
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-destructive hover:text-destructive"
          disabled={usedCount > 0 || isPending}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash className="mr-1 h-3 w-3" />
          類型表を削除
        </Button>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>類型表を削除しますか</AlertDialogTitle>
            <AlertDialogDescription>
              「{scoreScale.name || "名前なし"}」と、その類型
              {scoreScale.levels.length}件を削除します。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>やめる</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
