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
import { buttonVariants } from "@/components/ui/button"

interface DeleteDefinitionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 削除する解答用紙の名前（確認文に出す） */
  definitionName: string | undefined
  onConfirm: () => Promise<void>
}

/** 解答用紙を削除する前の確認ダイアログ */
export function DeleteDefinitionDialog({
  open,
  onOpenChange,
  definitionName,
  onConfirm,
}: DeleteDefinitionDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>解答用紙を削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            「{definitionName}
            」を削除します。この操作は取り消せません。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={(event) => {
              event.preventDefault()
              void onConfirm()
            }}
          >
            削除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
