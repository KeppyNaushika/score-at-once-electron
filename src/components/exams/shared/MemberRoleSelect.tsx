"use client"

import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import ConfirmationModal from "@/components/common/ConfirmationModal"
import { WithTooltip } from "@/components/common/WithTooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  EXAM_ROLE_LABELS,
  EXAM_ROLES,
  type ExamRole,
  parseExamRole,
} from "@/lib/shared/examRoles"
import {
  changeExamMemberRoleMutation,
  type ExamMemberRow,
} from "@/queries/userExam"

interface MemberRoleSelectProps {
  examId: string
  member: ExamMemberRow
  currentUserId: string
  /** 試験のオーナーの人数。最後の1人はほかの役割へ変えられない */
  ownerCount: number
}

/**
 * 参加者の役割を選ぶ（オーナーだけに見せる）。オーナー・採点者・閲覧者の3つ。
 *
 * オーナーを別の教員へ移すときは、相手をオーナーにしてから自分の役割を変える。
 *
 * - 最後の1人のオーナーは変えられない（選べなくし、理由を tooltip で出す。main も断る）
 * - 自分をオーナーから外すと、この試験のオーナー用の操作ができなくなるので確認を挟む
 */
export function MemberRoleSelect({
  examId,
  member,
  currentUserId,
  ownerCount,
}: MemberRoleSelectProps) {
  const changeRole = useMutation(changeExamMemberRoleMutation(examId))
  /** 自分をオーナーから外すときの行き先（確認を待っているあいだだけ持つ） */
  const [pendingSelfRole, setPendingSelfRole] = useState<ExamRole | null>(null)

  const currentRole = parseExamRole(member.role)
  const isSelf = member.user.id === currentUserId
  const isLastOwner = currentRole === "OWNER" && ownerCount <= 1

  const applyRole = async (role: ExamRole) => {
    try {
      await changeRole.mutateAsync({ userId: member.user.id, role })
    } catch {
      // 失敗の知らせは中央のトーストが出す
      return
    }
    setPendingSelfRole(null)
    toast.success(
      `「${member.user.name}」を${EXAM_ROLE_LABELS[role]}にしました`
    )
  }

  const handleRoleChange = (value: string) => {
    const role = parseExamRole(value)
    if (role === null || role === currentRole) return
    if (isSelf && currentRole === "OWNER") {
      setPendingSelfRole(role)
      return
    }
    void applyRole(role)
  }

  const select = (
    <Select
      value={currentRole ?? undefined}
      onValueChange={handleRoleChange}
      disabled={isLastOwner || changeRole.isPending}
    >
      <SelectTrigger
        size="sm"
        className="w-28"
        aria-label={`${member.user.name}の役割`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {EXAM_ROLES.map((role) => (
          <SelectItem key={role} value={role}>
            {EXAM_ROLE_LABELS[role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  return (
    <>
      {isLastOwner ? (
        // 無効の部品はポインタを拾わないので、外側の span で tooltip を受ける
        <WithTooltip content="最後のオーナーはほかの役割に変えられません。先に別の参加者をオーナーにしてください">
          <span tabIndex={0} className="inline-flex">
            {select}
          </span>
        </WithTooltip>
      ) : (
        select
      )}
      <ConfirmationModal
        open={pendingSelfRole !== null}
        onClose={() => setPendingSelfRole(null)}
        title={`自分を${pendingSelfRole ? EXAM_ROLE_LABELS[pendingSelfRole] : ""}にしますか？`}
        description="この試験のオーナーをやめます。"
        confirmText="変更する"
        variant="warning"
        warnings={[
          {
            type: "warning",
            message:
              "変更した後は、この試験の設定の変更・参加者の招待や役割の変更・採点担当の割り当て・採点の確定ができなくなります。もう一度オーナーにするには、ほかのオーナーに頼んでください。",
          },
        ]}
        onConfirm={() =>
          pendingSelfRole ? applyRole(pendingSelfRole) : undefined
        }
        loading={changeRole.isPending}
      />
    </>
  )
}
