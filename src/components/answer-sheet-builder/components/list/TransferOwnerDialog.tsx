"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useCallback } from "react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { transferAnswerSheetDefinitionOwnerMutation } from "@/queries/answerSheetBuilder"
import type { PublicUser } from "@/queries/user"
import { userListQuery } from "@/queries/user"
import type { ASBDefinitionListItem } from "@/types/answerSheetBuilder.types"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_USERS: PublicUser[] = []

interface TransferOwnerDialogProps {
  /** 渡す解答用紙（null のあいだは閉じている） */
  definition: ASBDefinitionListItem | null
  currentUserId: string
  onClose: () => void
}

/**
 * 担当を別の利用者へ渡すダイアログ。
 *
 * 編集できるのは担当者ひとりだけなので、他の人が直したいときはここで渡す。
 * 渡せるのは今の担当者だけ（横から取り上げられない）。
 */
export function TransferOwnerDialog({
  definition,
  currentUserId,
  onClose,
}: TransferOwnerDialogProps) {
  const { data: users = EMPTY_USERS } = useQuery(userListQuery())
  const candidates = users.filter((candidate) => candidate.id !== currentUserId)
  // 担当を渡す相手は選んだ1件ぶん。取り直す先もその1件のまとまりになるので、
  // 書き込みの宣言は「今どれを選んでいるか」から組む
  const { mutateAsync: transferOwnerOf } = useMutation(
    transferAnswerSheetDefinitionOwnerMutation(definition?.id ?? "")
  )

  const handleTransferOwner = useCallback(
    async (nextUserId: string) => {
      try {
        await transferOwnerOf({ currentUserId, nextUserId })
        toast.success("担当を渡しました")
      } catch {
        // 失敗の通知は MutationCache が出す
      }
    },
    [currentUserId, transferOwnerOf]
  )

  return (
    <Dialog
      open={definition !== null}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>担当を渡す</DialogTitle>
          <DialogDescription>
            「{definition?.name}
            」を編集できる人を切り替えます。渡した後は自分では
            編集できなくなります（閲覧と書き出しはできます）。
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-72 overflow-y-auto rounded-lg border border-border/50">
          {candidates.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              他に利用者がいません。
            </p>
          ) : (
            candidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                className="flex w-full items-center px-4 py-2.5 text-left text-sm hover:bg-muted/50"
                onClick={async () => {
                  if (!definition) return
                  await handleTransferOwner(candidate.id)
                  onClose()
                }}
              >
                {candidate.name}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
