"use client"

import { Exam } from "@prisma/client"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import ConfirmationModal from "@/components/common/ConfirmationModal"

interface DeleteExamModalProps {
  exam: Exam & {
    masterImages?: unknown[]
    answerSheets?: unknown[]
    cropRegions?: unknown[]
    examTags?: { tag: { id: string; name: string } }[]
  }
  open: boolean
  onOpenChange: (open: boolean) => void
  onExamDeleted: () => void
}

export default function DeleteExamModal({
  exam,
  open,
  onOpenChange,
  onExamDeleted,
}: DeleteExamModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [examData, setExamData] = useState<{
    masterImageCount: number
    answerSheetCount: number
    cropRegionCount: number
  }>({
    masterImageCount: 0,
    answerSheetCount: 0,
    cropRegionCount: 0,
  })

  useEffect(() => {
    if (exam) {
      setExamData({
        masterImageCount: exam.masterImages?.length || 0,
        answerSheetCount: exam.answerSheets?.length || 0,
        cropRegionCount: exam.cropRegions?.length || 0,
      })
    }
  }, [exam])

  const handleDelete = async () => {
    if (!exam) return

    try {
      setIsLoading(true)
      await window.electronAPI.deleteExam(exam.id)
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

  const hasData =
    examData.masterImageCount > 0 ||
    examData.answerSheetCount > 0 ||
    examData.cropRegionCount > 0

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
            message: `削除されるデータ: 模範解答${examData.masterImageCount}件、採点領域${examData.cropRegionCount}件、答案${examData.answerSheetCount}件`,
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
