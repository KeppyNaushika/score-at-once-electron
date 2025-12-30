"use client"

import ConfirmationModal from "@/components/common/ConfirmationModal"
import { Project } from "@prisma/client"
import { useEffect, useState } from "react"
import { toast } from "sonner"

interface DeleteProjectModalProps {
  project: Project & {
    masterImages?: unknown[]
    answerSheets?: unknown[]
    cropRegions?: unknown[]
  }
  open: boolean
  onOpenChange: (open: boolean) => void
  onProjectDeleted: () => void
}

export default function DeleteProjectModal({
  project,
  open,
  onOpenChange,
  onProjectDeleted,
}: DeleteProjectModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [projectData, setProjectData] = useState<{
    masterImageCount: number
    answerSheetCount: number
    cropRegionCount: number
  }>({
    masterImageCount: 0,
    answerSheetCount: 0,
    cropRegionCount: 0,
  })

  useEffect(() => {
    if (project) {
      setProjectData({
        masterImageCount: project.masterImages?.length || 0,
        answerSheetCount: project.answerSheets?.length || 0,
        cropRegionCount: project.cropRegions?.length || 0,
      })
    }
  }, [project])

  const handleDelete = async () => {
    if (!project) return

    try {
      setIsLoading(true)
      await window.electronAPI.deleteProject(project.id)
      toast.success("プロジェクトを削除しました")
      onProjectDeleted()
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to delete project:", error)
      toast.error("プロジェクトの削除に失敗しました")
    } finally {
      setIsLoading(false)
    }
  }

  const hasData =
    projectData.masterImageCount > 0 ||
    projectData.answerSheetCount > 0 ||
    projectData.cropRegionCount > 0

  // プロジェクト情報をアイテムとして構成
  const projectItems = project
    ? [
        {
          id: project.id,
          display: project.examName,
          badges: [
            ...(project.subject
              ? [{ label: project.subject, variant: "outline" as const }]
              : []),
            ...(project.examDate
              ? [
                  {
                    label: new Date(project.examDate).toLocaleDateString(),
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
            message: `削除されるデータ: 模範解答${projectData.masterImageCount}件、採点領域${projectData.cropRegionCount}件、答案${projectData.answerSheetCount}件`,
          },
        ]
      : []),
  ]

  return (
    <ConfirmationModal
      open={open}
      onClose={() => onOpenChange(false)}
      title="プロジェクトの削除"
      description="以下のプロジェクトを完全に削除します。"
      confirmText="削除する"
      cancelText="キャンセル"
      variant="destructive"
      icon="trash"
      items={projectItems}
      warnings={warnings}
      onConfirm={handleDelete}
      loading={isLoading}
    />
  )
}
