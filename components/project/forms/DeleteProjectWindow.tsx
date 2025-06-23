import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import React from "react"

interface DeleteProjectWindowProps {
  projectToDelete: any
  onClose: () => void
  onDelete: () => Promise<void>
}

const DeleteProjectWindow: React.FC<DeleteProjectWindowProps> = ({
  projectToDelete,
  onClose,
  onDelete,
}) => {
  const handleDelete = async () => {
    try {
      await onDelete()
    } catch (error) {
      console.error("Failed to delete project:", error)
    }
  }

  if (!projectToDelete) return null

  return (
    <AlertDialog open={true} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>本当に削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            以下のプロジェクトがデータベースから完全に削除されます。この操作は元に戻せません。
            <br />
            <span className="font-semibold">{projectToDelete.examName}</span>
            <span className="text-sm text-gray-500">
              {" ("}
              {projectToDelete.examDate
                ? new Date(projectToDelete.examDate).toLocaleDateString()
                : "日付未設定"}
              {")"}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" onClick={onClose}>
              キャンセル
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="destructive" onClick={handleDelete}>
              削除する
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export default DeleteProjectWindow
