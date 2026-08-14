"use client"

import { useMutation } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import ConfirmationModal from "@/components/common/ConfirmationModal"
import { useAuth } from "@/contexts/AuthContext"
import type { ExamForDetail } from "@/hooks/useExamDetail"
import { deleteExamMutation } from "@/queries/exam"

interface DeleteExamModalProps {
  exam: ExamForDetail
  /** 模範解答画像の件数（useExamDetailで集計） */
  masterImageCount: number
  /** 答案画像の件数（useExamDetailで集計） */
  answerSheetCount: number
  /** 採点領域の件数（useExamDetailで集計） */
  cropRegionCount: number
  /** この試験を参照している成績データソースの件数 */
  gradeDataSourceCount: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onExamDeleted: () => void
}

export default function DeleteExamModal({
  exam,
  masterImageCount,
  answerSheetCount,
  cropRegionCount,
  gradeDataSourceCount,
  open,
  onOpenChange,
  onExamDeleted,
}: DeleteExamModalProps) {
  const { user } = useAuth()
  const deleteExam = useMutation(deleteExamMutation(user?.id))
  const [isLoading, setIsLoading] = useState(false)

  const handleDelete = async () => {
    if (!exam) return

    try {
      setIsLoading(true)
      await deleteExam.mutateAsync(exam.id)
      toast.success("試験を削除しました")
      onExamDeleted()
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to delete exam:", error)
      toast.error("試験の削除に失敗しました")
    } finally {
      setIsLoading(false)
    }
  }

  const deletedDataLabels = [
    { label: "模範解答", count: masterImageCount },
    { label: "採点領域", count: cropRegionCount },
    { label: "答案", count: answerSheetCount },
  ]
    .filter((entry) => entry.count > 0)
    .map((entry) => `${entry.label}${entry.count}件`)

  const hasData = deletedDataLabels.length > 0

  // 試験情報をアイテムとして構成
  const examItems = exam
    ? [
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
    : []

  // 警告メッセージを構成
  const warnings = [
    {
      type: "destructive" as const,
      message:
        "この操作は取り消せません。" +
        (hasData ? "関連するすべてのデータも同時に削除されます。" : ""),
    },
    ...(hasData
      ? [
          {
            type: "warning" as const,
            message: `削除されるデータ: ${deletedDataLabels.join("、")}（採点結果と画像ファイルを含む）`,
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
      loading={isLoading}
    />
  )
}
