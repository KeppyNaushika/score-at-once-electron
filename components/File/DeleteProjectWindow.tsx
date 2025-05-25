import { Prisma } from "@prisma/client"
import React from "react"

interface DeleteProjectWindowProps {
  projectToDelete: Prisma.ProjectGetPayload<{ include: { tags: true } }>
  onClose: () => void
  onDelete: () => Promise<void> // Or (project: Project) => Promise<void> if you pass it back
}

const DeleteProjectWindow: React.FC<DeleteProjectWindowProps> = ({
  projectToDelete,
  onClose,
  onDelete,
}) => {
  const handleDelete = async () => {
    try {
      await onDelete()
      // onClose will be called by the parent after onDelete completes
    } catch (error) {
      console.error("Failed to delete project:", error)
      // Optionally, display an error message to the user
    }
  }

  if (!projectToDelete) return null

  return (
    <div className="animate-float-in absolute inset-0 z-20 flex min-h-full min-w-full flex-col items-center justify-center border-2 bg-white/80">
      <div className="text-2xl">本当に削除しますか？</div>
      <div className="py-4 text-center">
        <p>以下のプロジェクトが削除されます:</p>
        <p className="font-bold">{projectToDelete.examName}</p>
        <p className="text-sm text-gray-600">
          (
          {projectToDelete.examDate
            ? new Date(projectToDelete.examDate).toLocaleDateString()
            : "日付未設定"}
          )
        </p>
      </div>
      <div className="flex py-10">
        <div
          className="flex h-16 w-40 cursor-pointer items-center justify-center rounded-md bg-red-500 text-white"
          onClick={handleDelete}
        >
          削除する
        </div>
        <div className="w-20"></div>
        <div
          className="flex h-16 w-40 cursor-pointer items-center justify-center rounded-md bg-gray-300"
          onClick={onClose} // Use onClose prop
        >
          戻る
        </div>
      </div>
    </div>
  )
}

export default DeleteProjectWindow
