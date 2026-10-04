"use client"

import { useMutation } from "@tanstack/react-query"
import { Crown, UserRound } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import ConfirmationModal from "@/components/common/ConfirmationModal"
import { WithTooltip } from "@/components/common/WithTooltip"
import { Button } from "@/components/ui/button"
import {
  changeExamMemberRoleMutation,
  type ExamMemberRow,
} from "@/queries/userExam"

interface MemberRoleButtonProps {
  examId: string
  member: ExamMemberRow
  currentUserId: string
  /** 試験のオーナーの人数。最後の1人は採点者へ戻せない */
  ownerCount: number
}

/**
 * 参加者の役割を変えるボタン（オーナーだけに見せる）。
 *
 * 採点者は「オーナーにする」、オーナーは「採点者に戻す」。オーナーを別の教員へ
 * 移すときは、相手をオーナーにしてから自分を採点者へ戻す。
 *
 * - 最後の1人のオーナーは戻せない（押せなくし、理由を tooltip で出す。main も断る）
 * - 自分を戻すと、この試験のオーナー用の操作ができなくなるので確認を挟む
 */
export function MemberRoleButton({
  examId,
  member,
  currentUserId,
  ownerCount,
}: MemberRoleButtonProps) {
  const changeRole = useMutation(changeExamMemberRoleMutation(examId))
  const [isConfirmingSelfDemotion, setIsConfirmingSelfDemotion] =
    useState(false)

  const isSelf = member.user.id === currentUserId

  const handlePromote = () => {
    changeRole.mutate(
      { userId: member.user.id, role: "OWNER" },
      {
        onSuccess: () =>
          toast.success(`「${member.user.name}」をオーナーにしました`),
      }
    )
  }

  const demote = async () => {
    try {
      await changeRole.mutateAsync({ userId: member.user.id, role: "GRADER" })
    } catch {
      // 失敗の知らせは中央のトーストが出す
      return
    }
    setIsConfirmingSelfDemotion(false)
    toast.success(`「${member.user.name}」を採点者に戻しました`)
  }

  if (member.role !== "OWNER") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handlePromote}
        disabled={changeRole.isPending}
      >
        <Crown className="mr-1 h-4 w-4" />
        オーナーにする
      </Button>
    )
  }

  if (ownerCount <= 1) {
    // 無効のボタンはポインタを拾わないので、外側の span で tooltip を受ける
    return (
      <WithTooltip content="最後のオーナーは採点者に戻せません。先に別の参加者をオーナーにしてください">
        <span tabIndex={0} className="inline-flex">
          <Button variant="outline" size="sm" disabled>
            <UserRound className="mr-1 h-4 w-4" />
            採点者に戻す
          </Button>
        </span>
      </WithTooltip>
    )
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          isSelf ? setIsConfirmingSelfDemotion(true) : void demote()
        }
        disabled={changeRole.isPending}
      >
        <UserRound className="mr-1 h-4 w-4" />
        採点者に戻す
      </Button>
      <ConfirmationModal
        open={isConfirmingSelfDemotion}
        onClose={() => setIsConfirmingSelfDemotion(false)}
        title="自分を採点者に戻しますか？"
        description="この試験のオーナーをやめます。"
        confirmText="採点者に戻す"
        variant="warning"
        warnings={[
          {
            type: "warning",
            message:
              "戻した後は、この試験の設定の変更・参加者の招待や役割の変更・採点の確定ができなくなります。もう一度オーナーにするには、ほかのオーナーに頼んでください。",
          },
        ]}
        onConfirm={demote}
        loading={changeRole.isPending}
      />
    </>
  )
}
