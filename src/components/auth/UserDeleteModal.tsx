"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useCallback } from "react"
import { toast } from "sonner"

import ConfirmationModal from "@/components/common/ConfirmationModal"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { useConfirmedDeletion } from "@/hooks/useConfirmedDeletion"
import {
  buildSoleOwnerBlockedMessage,
  findSoleOwnedExams,
} from "@/lib/shared/userSoleOwnership"
import {
  deleteUserMutation,
  type PublicUser,
  userDeletionCountsQuery,
  userExamOwnershipsQuery,
} from "@/queries/user"
import type { ConfirmedDeletionCount } from "@/types/deletionConfirmation.types"

interface UserDeleteModalProps {
  user: PublicUser
  isOpen: boolean
  onClose: () => void
}

/**
 * 利用者の削除確認。
 *
 * 利用者を消すと、その利用者の採点結果・確定・解答用紙・試験への参加なども一緒に
 * 消え、同期しているすべての端末から消える。元に戻す手段は無い。消える前に何が
 * 消えるかを見せることがこのダイアログの役目である
 * （docs/ownership-and-sharing-design.md §4.4）。
 *
 * 件数は main が数えて返す（採点結果が多く、行を運ぶと重いため）。表示にも
 * 削除の要求にも同じ配列を使い、main は消す直前に数え直して、増えていれば中止する。
 *
 * 閉じている間はマウントしない前提（開くたびに数え直す）。
 */
export function UserDeleteModal({
  user,
  isOpen,
  onClose,
}: UserDeleteModalProps) {
  const currentUser = useCurrentUser()
  const isCurrentUser = user.id === currentUser.id
  const deleteUser = useMutation(deleteUserMutation())

  // **`isFetching` で止める。** 開くたびの取り直しが着地する前に、キャッシュに
  // 残った古い件数のまま確定できないようにする
  const {
    data: deletionCounts,
    isFetching: isCountingDeletion,
    error: countsError,
    refetch: refetchDeletionCounts,
  } = useQuery(userDeletionCountsQuery(user.id))
  const {
    data: examOwnerships,
    isFetching: isCheckingOwnership,
    error: ownershipError,
    refetch: refetchExamOwnerships,
  } = useQuery(userExamOwnershipsQuery(user.id))

  // 取り直している間・照会に失敗した間は null（＝押させない）
  const shownCounts =
    isCountingDeletion || deletionCounts === undefined ? null : deletionCounts

  const blockedMessage = examOwnerships
    ? buildSoleOwnerBlockedMessage(findSoleOwnedExams(examOwnerships))
    : null

  const { canConfirm, isDeleting, refusalMessage, confirmDeletion } =
    useConfirmedDeletion({
      confirmedCounts: shownCounts,
      deleteWithConfirmedCounts: useCallback(
        async (confirmedCounts: ConfirmedDeletionCount[]) => {
          await deleteUser.mutateAsync({ userId: user.id, confirmedCounts })
        },
        [deleteUser, user.id]
      ),
      // 断られた理由が「ただ1人の所有者」なら、その一覧も取り直して見せる
      recount: useCallback(
        () => Promise.all([refetchDeletionCounts(), refetchExamOwnerships()]),
        [refetchDeletionCounts, refetchExamOwnerships]
      ),
    })

  const handleDelete = async () => {
    if (!(await confirmDeletion())) return
    toast.success(`利用者「${user.name}」を削除しました`)
    onClose()
  }

  const destroyedLabels = (shownCounts ?? []).map(
    (deletionCount) =>
      `${deletionCount.countedName}${deletionCount.shownCount}件`
  )

  const warnings = [
    ...(isCurrentUser
      ? [
          {
            type: "destructive" as const,
            message: "ログイン中の利用者は削除できません。",
          },
        ]
      : []),
    {
      type: "destructive" as const,
      message:
        "この利用者と、その採点結果などのデータは、同期しているすべての端末から消えます。元に戻せません。",
    },
    ...(isCountingDeletion || isCheckingOwnership
      ? [{ type: "info" as const, message: "消えるデータを数えています…" }]
      : []),
    // 照会に失敗したら「消えるものは無い」と誤解させないよう、押させない
    ...(countsError || ownershipError
      ? [
          {
            type: "destructive" as const,
            message:
              "消えるデータを確認できなかったため削除できません。開き直してください。",
          },
        ]
      : []),
    ...(shownCounts && destroyedLabels.length > 0
      ? [
          {
            type: "warning" as const,
            message: `一緒に消えるデータ: ${destroyedLabels.join("、")}`,
          },
        ]
      : []),
    ...(shownCounts && destroyedLabels.length === 0
      ? [
          {
            type: "info" as const,
            message: "この利用者の採点結果や解答用紙はありません。",
          },
        ]
      : []),
    {
      type: "warning" as const,
      message:
        "他の端末でまだ同期していないこの利用者の採点は、削除より前のものは消え、削除より後のものは表示されなくなります。\n削除する前に、この利用者が他の端末で採点していないことを確かめ、同期を済ませてください。",
    },
    ...(blockedMessage
      ? [{ type: "destructive" as const, message: blockedMessage }]
      : []),
    // 数えた後に他の教員が書き足していれば main が中止する。閉じずに数え直した
    // 結果を見せ、利用者にもう一度決めてもらう。所有者の理由で断られたときは、
    // 取り直した一覧と同じ文言になるので重ねない
    ...(refusalMessage && refusalMessage !== blockedMessage
      ? [{ type: "destructive" as const, message: refusalMessage }]
      : []),
  ]

  return (
    <ConfirmationModal
      open={isOpen}
      onClose={onClose}
      title="利用者の削除"
      description="以下の利用者を削除します。"
      confirmText="削除する"
      cancelText="キャンセル"
      variant="destructive"
      icon="trash"
      items={[
        {
          id: user.id,
          display: user.name,
          badges: [{ label: `@${user.username}`, variant: "outline" }],
        },
      ]}
      warnings={warnings}
      onConfirm={handleDelete}
      loading={isDeleting}
      // 数え終わるまで・所有者を調べ終わるまで、またただ1人の所有者の試験が
      // ある間は押させない（main も同じ判定で断る）
      confirmDisabled={
        isCurrentUser ||
        !canConfirm ||
        isCheckingOwnership ||
        examOwnerships === undefined ||
        blockedMessage !== null
      }
    />
  )
}
