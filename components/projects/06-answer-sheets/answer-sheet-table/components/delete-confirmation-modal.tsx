"use client"

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
import { AlertTriangle } from "lucide-react"

interface DeleteConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  studentName?: string
  pageNumber?: number
  hasScoreData?: boolean
}

export function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  studentName,
  pageNumber,
  hasScoreData = false,
}: DeleteConfirmationModalProps) {
  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            答案画像の削除確認
          </AlertDialogTitle>
          <AlertDialogDescription>
            <div className="space-y-2">
              <p>
                以下の答案画像を削除しようとしています：
              </p>
              {studentName && (
                <div className="rounded bg-gray-50 p-2">
                  <p className="font-medium">生徒名: {studentName}</p>
                  {pageNumber && <p>ページ: {pageNumber}</p>}
                </div>
              )}
              <div className="rounded bg-red-50 p-3 text-red-800">
                <p className="font-medium">⚠️ 警告</p>
                <ul className="mt-1 list-disc list-inside space-y-1 text-sm">
                  <li>この操作は取り消せません</li>
                  <li>答案画像ファイルが完全に削除されます</li>
                  {hasScoreData && (
                    <li className="font-medium">関連する採点データも全て削除されます</li>
                  )}
                </ul>
              </div>
              <p className="text-sm text-gray-600">
                本当に削除してもよろしいですか？
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>
            キャンセル
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-red-600 hover:bg-red-700"
          >
            削除する
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}