"use client"

import type { Student } from "@prisma/client"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import ConfirmationModal from "@/components/common/ConfirmationModal"
import { buildDeletionBlockedMessage } from "@/lib/shared/gradeReferenceMessages"
import { gradeReferencesQuery } from "@/queries/grade"
import { deleteStudentMutation } from "@/queries/student"

interface DeleteStudentModalProps {
  /** 消そうとしている生徒（null のとき閉じている）。一覧・詳細のどちらの行も渡せる */
  student: Student | null
  onClose: () => void
  /** 削除できた後に呼ぶ（閉じるのはこのモーダルが行う） */
  onDeleted?: (studentId: string) => void
}

/**
 * 生徒の削除確認。生徒一覧と生徒詳細の両方から開く。
 *
 * 成績算出の名簿に載っている生徒は消させない（名簿の行が Cascade で消え、手動点数・
 * 上書き・確定値も黙って失われるため）。どの成績算出かを前もって見せ、main も同じ
 * 判定で最終的に断る。
 */
export function DeleteStudentModal({
  student,
  onClose,
  onDeleted,
}: DeleteStudentModalProps) {
  const queryClient = useQueryClient()
  const deleteStudent = useMutation(deleteStudentMutation())
  // 断られたときの文言。閉じずに出し、利用者にもう一度決めてもらう
  const [refusal, setRefusal] = useState<{
    studentId: string
    message: string
  } | null>(null)
  const refusalMessage =
    refusal !== null && refusal.studentId === student?.id
      ? refusal.message
      : null

  const open = student !== null
  const gradeReferences = useQuery({
    ...gradeReferencesQuery({ kind: "student", id: student?.id ?? "" }),
    enabled: open,
  })
  const blockedMessage = gradeReferences.data
    ? buildDeletionBlockedMessage("student", gradeReferences.data)
    : null

  const handleDelete = async () => {
    if (student === null) return
    setRefusal(null)
    try {
      await deleteStudent.mutateAsync(student.id)
    } catch (error) {
      setRefusal({
        studentId: student.id,
        message:
          error instanceof Error && error.message
            ? error.message
            : "削除できませんでした。もう一度確認してください。",
      })
      // 断られた理由が「成績算出の名簿に載っている」なら、その一覧も取り直して見せる
      await queryClient
        .refetchQueries({
          queryKey: gradeReferencesQuery({ kind: "student", id: student.id })
            .queryKey,
        })
        .catch(() => {})
      return
    }
    toast.success(
      `生徒「${student.lastName} ${student.firstName}」を削除しました`
    )
    onClose()
    onDeleted?.(student.id)
  }

  const warnings = [
    {
      type: "destructive" as const,
      message:
        "この操作は取り消せません。学級の所属と、試験の答案・採点結果、試験外成績資料に入力された点数も削除されます。",
    },
    ...(blockedMessage
      ? [{ type: "destructive" as const, message: blockedMessage }]
      : []),
    // 名簿に載っていて断られたときは、取り直した一覧と同じ文言になるので重ねない
    ...(refusalMessage && refusalMessage !== blockedMessage
      ? [{ type: "destructive" as const, message: refusalMessage }]
      : []),
  ]

  return (
    <ConfirmationModal
      open={open}
      onClose={onClose}
      title="生徒の削除"
      description="以下の生徒を完全に削除します。"
      confirmText="削除する"
      cancelText="キャンセル"
      variant="destructive"
      icon="trash"
      items={
        student
          ? [
              {
                id: student.id,
                display: `${student.lastName} ${student.firstName}`,
                badges: [
                  {
                    label: student.studentNumber,
                    variant: "outline" as const,
                  },
                ],
              },
            ]
          : []
      }
      warnings={warnings}
      onConfirm={handleDelete}
      loading={deleteStudent.isPending}
      // 名簿に載っているかを調べ終わるまで、また載っている間は押させない
      // （調べるのに失敗したときは押せるが、main が同じ判定で断る）
      confirmDisabled={gradeReferences.isPending || blockedMessage !== null}
    />
  )
}
