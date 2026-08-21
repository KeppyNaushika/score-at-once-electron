"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { toast } from "sonner"

import ConfirmationModal from "@/components/common/ConfirmationModal"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { useConfirmedDeletion } from "@/hooks/useConfirmedDeletion"
import { DELETION_COUNT_NAME } from "@/lib/shared/deletionCountNames"
import type { ExamForDetail } from "@/queries/exam"
import { deleteExamMutation, examForDetailQuery } from "@/queries/exam"
import type { ConfirmedDeletionCount } from "@/types/deletionConfirmation.types"

interface DeleteExamModalProps {
  exam: ExamForDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  onExamDeleted: () => void
}

/**
 * 試験を消すと巻き添えになるものを数える。
 *
 * **表示にも送信にも同じ配列を使う**（見せたものと送るものが同じなら食い違わない）。
 * main は消す直前にこれと同じ定義で数え直し、増えていれば中止する（段階26）。
 */
function countExamDeletion(exam: ExamForDetail): ConfirmedDeletionCount[] {
  const examPages = exam.examPages ?? []
  return [
    {
      countedName: DELETION_COUNT_NAME.masterAnswer,
      shownCount: examPages.filter((examPage) => examPage.imagePath).length,
    },
    {
      countedName: DELETION_COUNT_NAME.cropRegion,
      shownCount: examPages.reduce(
        (total, examPage) => total + (examPage.cropRegions?.length ?? 0),
        0
      ),
    },
    {
      countedName: DELETION_COUNT_NAME.answerSheet,
      shownCount: examPages.reduce(
        (total, examPage) =>
          total + (examPage.studentAnswerImages?.length ?? 0),
        0
      ),
    },
    {
      countedName: DELETION_COUNT_NAME.gradeDataSource,
      shownCount: exam.gradeDataSources?.length ?? 0,
    },
  ].filter((deletionCount) => deletionCount.shownCount > 0)
}

export default function DeleteExamModal({
  exam,
  open,
  onOpenChange,
  onExamDeleted,
}: DeleteExamModalProps) {
  const currentUser = useCurrentUser()
  const queryClient = useQueryClient()
  const deleteExam = useMutation(deleteExamMutation(currentUser.id))

  const deletionCounts = countExamDeletion(exam)

  const { isDeleting, refusalMessage, confirmDeletion } = useConfirmedDeletion({
    confirmedCounts: deletionCounts,
    deleteWithConfirmedCounts: useCallback(
      async (confirmedCounts: ConfirmedDeletionCount[]) => {
        await deleteExam.mutateAsync({ examId: exam.id, confirmedCounts })
      },
      [deleteExam, exam.id]
    ),
    // 件数は試験の取得結果から数えているので、取り直せば数え直したことになる
    recount: useCallback(
      () =>
        queryClient.refetchQueries({
          queryKey: examForDetailQuery(exam.id).queryKey,
        }),
      [exam.id, queryClient]
    ),
  })

  const handleDelete = async () => {
    if (!(await confirmDeletion())) return
    toast.success("試験を削除しました")
    onExamDeleted()
    onOpenChange(false)
  }

  // 成績データソースは参照を失うだけで消えないため、警告文を分けて出す
  const destroyedLabels = deletionCounts
    .filter(
      (deletionCount) =>
        deletionCount.countedName !== DELETION_COUNT_NAME.gradeDataSource
    )
    .map(
      (deletionCount) =>
        `${deletionCount.countedName}${deletionCount.shownCount}件`
    )
  const gradeDataSourceCount =
    deletionCounts.find(
      (deletionCount) =>
        deletionCount.countedName === DELETION_COUNT_NAME.gradeDataSource
    )?.shownCount ?? 0

  // 試験情報をアイテムとして構成
  const examItems = [
    {
      id: exam.id,
      display: exam.examName,
      badges: [
        ...(exam.examTags ?? []).map((examTag) => ({
          label: examTag.tag.name,
          variant: "outline" as const,
        })),
        ...(exam.examDate
          ? [
              {
                label: new Date(exam.examDate).toLocaleDateString(),
                variant: "secondary" as const,
              },
            ]
          : []),
      ],
    },
  ]

  // 警告メッセージを構成
  const warnings = [
    {
      type: "destructive" as const,
      message:
        "この操作は取り消せません。" +
        (destroyedLabels.length > 0
          ? "関連するすべてのデータも同時に削除されます。"
          : ""),
    },
    ...(destroyedLabels.length > 0
      ? [
          {
            type: "warning" as const,
            message: `削除されるデータ: ${destroyedLabels.join("、")}（採点結果と画像ファイルを含む）`,
          },
        ]
      : []),
    ...(gradeDataSourceCount > 0
      ? [
          {
            type: "warning" as const,
            message: `この試験を参照している成績データソース${gradeDataSourceCount}件が参照を失います。該当する成績の評価項目を確認してください。`,
          },
        ]
      : []),
    // 数えた後に他の教員が書き足していれば main が中止する。閉じずに
    // 数え直した結果を見せ、利用者にもう一度決めてもらう
    ...(refusalMessage
      ? [{ type: "destructive" as const, message: refusalMessage }]
      : []),
  ]

  return (
    <ConfirmationModal
      open={open}
      onClose={() => onOpenChange(false)}
      title="試験の削除"
      description="以下の試験を完全に削除します。"
      confirmText="削除する"
      cancelText="キャンセル"
      variant="destructive"
      icon="trash"
      items={examItems}
      warnings={warnings}
      onConfirm={handleDelete}
      loading={isDeleting}
    />
  )
}
