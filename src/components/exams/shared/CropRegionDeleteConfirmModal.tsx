"use client"

import { useQuery } from "@tanstack/react-query"

import { CautionNotice } from "@/components/common/CautionNotice"
import { ConfirmationTitleRow } from "@/components/common/ConfirmationTitleRow"
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
import { buttonVariants } from "@/components/ui/button"
import {
  buildItemDeletionWarning,
  cropRegionUsages,
} from "@/lib/shared/gradeReferenceMessages"
import { examDetailQuery } from "@/queries/exam"

type CropRegionDeleteConfirmModalProps = {
  isOpen: boolean
  examId: string
  /** 消そうとしている領域。成績算出で使われていれば影響を見せる */
  cropRegionId: string | null
  onClose: () => void
  onConfirm: () => void
}

/**
 * 領域（設問）の削除確認。2. 領域作成（キーでの削除を含む）と 3. 領域設定 の両方から開く。
 *
 * 成績算出で使われていても消せるが、どの成績算出のどのデータソースに影響するかを
 * 見せる（設問のデータソースはカスケードで消え、試験の合計点・小計は値が変わる）。
 * 使っているデータソースは試験の詳細（layout も読む）に同梱してある。
 */
export const CropRegionDeleteConfirmModal = ({
  isOpen,
  examId,
  cropRegionId,
  onClose,
  onConfirm,
}: CropRegionDeleteConfirmModalProps) => {
  const examDetail = useQuery({
    ...examDetailQuery(examId),
    enabled: isOpen && cropRegionId !== null,
  })
  const gradeWarning =
    examDetail.data && cropRegionId !== null
      ? buildItemDeletionWarning(
          "cropRegion",
          cropRegionUsages(examDetail.data, cropRegionId)
        )
      : null

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <ConfirmationTitleRow variant="destructive">
            <AlertDialogTitle>領域を削除しますか？</AlertDialogTitle>
          </ConfirmationTitleRow>
          <AlertDialogDescription>
            この領域の採点データも一緒に削除されます。この操作は元に戻すことができません。
          </AlertDialogDescription>
        </AlertDialogHeader>
        {gradeWarning && <CautionNotice>{gradeWarning}</CautionNotice>}
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={(event) => {
              // 閉じるのは呼び出し側が削除を終えてから
              event.preventDefault()
              onConfirm()
            }}
            // 試験の詳細が読めるまでは押させない（影響を見せる前に消さない）
            disabled={cropRegionId !== null && examDetail.isPending}
          >
            削除する
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
