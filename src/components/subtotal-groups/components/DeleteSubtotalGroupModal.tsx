"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import ConfirmationModal from "@/components/common/ConfirmationModal"
import { buildDeletionBlockedMessage } from "@/lib/shared/gradeReferenceMessages"
import { gradeReferencesQuery } from "@/queries/grade"
import {
  deleteSubtotalGroupMutation,
  type SubtotalGroupRow,
} from "@/queries/subtotal"

interface DeleteSubtotalGroupModalProps {
  /** 消そうとしているグループ（null のとき閉じている） */
  group: SubtotalGroupRow | null
  onClose: () => void
}

/**
 * 小計点グループの削除確認。
 *
 * 成績算出のデータソースが中の小計項目を使っていれば消させない（小計項目を消すと
 * データソースは Cascade で黙って消えるため）。main も同じ判定で最終的に断る。
 * 設問の割り当てがある場合も main が断り、その理由（どの設問か）は断られた文言に載る。
 */
export function DeleteSubtotalGroupModal({
  group,
  onClose,
}: DeleteSubtotalGroupModalProps) {
  const queryClient = useQueryClient()
  const deleteSubtotalGroup = useMutation(deleteSubtotalGroupMutation())
  // 断られたときの文言。閉じずに出し、利用者にもう一度決めてもらう
  const [refusal, setRefusal] = useState<{
    groupId: string
    message: string
  } | null>(null)
  const refusalMessage =
    refusal !== null && refusal.groupId === group?.id ? refusal.message : null

  const open = group !== null
  const gradeReferences = useQuery({
    ...gradeReferencesQuery({ kind: "subtotalGroup", id: group?.id ?? "" }),
    enabled: open,
  })
  const blockedMessage = gradeReferences.data
    ? buildDeletionBlockedMessage("subtotalGroup", gradeReferences.data)
    : null

  const handleDelete = async () => {
    if (group === null) return
    setRefusal(null)
    try {
      await deleteSubtotalGroup.mutateAsync(group.id)
    } catch (error) {
      setRefusal({
        groupId: group.id,
        message:
          error instanceof Error && error.message
            ? error.message
            : "削除できませんでした。もう一度確認してください。",
      })
      // 断られた理由が「成績算出で使われている」なら、その一覧も取り直して見せる
      await queryClient
        .refetchQueries({
          queryKey: gradeReferencesQuery({
            kind: "subtotalGroup",
            id: group.id,
          }).queryKey,
        })
        .catch(() => {})
      return
    }
    toast.success(`小計点グループ「${group.name}」を削除しました`)
    onClose()
  }

  const warnings = [
    {
      type: "destructive" as const,
      message: "この操作は取り消せません。グループ内の小計項目も削除されます。",
    },
    {
      type: "info" as const,
      message:
        "設問との関連付けがある場合は削除できません。削除前に、使っている試験の「4. 小計点」タブで設問の割り当てを解除してください。",
    },
    ...(blockedMessage
      ? [{ type: "destructive" as const, message: blockedMessage }]
      : []),
    // 成績算出で使われていて断られたときは、取り直した一覧と同じ文言になるので重ねない
    ...(refusalMessage && refusalMessage !== blockedMessage
      ? [{ type: "destructive" as const, message: refusalMessage }]
      : []),
  ]

  return (
    <ConfirmationModal
      open={open}
      onClose={onClose}
      title="小計点グループの削除"
      description="以下の小計点グループを削除します。"
      confirmText="削除する"
      cancelText="キャンセル"
      variant="destructive"
      icon="trash"
      items={
        group
          ? [
              {
                id: group.id,
                display: group.name,
                badges: group.subtotals.map((subtotal) => ({
                  label: subtotal.name,
                  variant: "outline" as const,
                })),
              },
            ]
          : []
      }
      warnings={warnings}
      onConfirm={handleDelete}
      loading={deleteSubtotalGroup.isPending}
      // 使われているかを調べ終わるまで、また使われている間は押させない
      // （調べるのに失敗したときは押せるが、main が同じ判定で断る）
      confirmDisabled={gradeReferences.isPending || blockedMessage !== null}
    />
  )
}
