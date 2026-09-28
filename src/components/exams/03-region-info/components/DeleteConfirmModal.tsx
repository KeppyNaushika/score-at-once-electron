"use client"

import { useQuery } from "@tanstack/react-query"
import { AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal"
import { buildItemDeletionWarning } from "@/lib/shared/gradeReferenceMessages"
import { gradeReferencesQuery } from "@/queries/grade"

type DeleteConfirmModalProps = {
  isOpen: boolean
  /** 消そうとしている領域。成績算出で使われていれば影響を見せる */
  cropRegionId: string | null
  onClose: () => void
  onConfirm: () => void
}

/**
 * 領域（設問）の削除確認。2. 採点領域（キーでの削除を含む）と 3. 領域情報 の両方から開く。
 *
 * 成績算出で使われていても消せるが、どの成績算出のどのデータソースに影響するかを
 * 見せる（設問のデータソースはカスケードで消え、試験の合計点・小計は値が変わる）。
 */
export const DeleteConfirmModal = ({
  isOpen,
  cropRegionId,
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) => {
  const gradeReferences = useQuery({
    ...gradeReferencesQuery({ kind: "cropRegion", id: cropRegionId ?? "" }),
    enabled: isOpen && cropRegionId !== null,
  })
  const gradeWarning = gradeReferences.data
    ? buildItemDeletionWarning("cropRegion", gradeReferences.data)
    : null

  return (
    <Modal open={isOpen} onOpenChange={onClose}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <span>領域の削除確認</span>
          </ModalTitle>
          <ModalDescription>
            この領域を削除しますか？ ⚠️
            注意：この領域に関連付けられた採点データがある場合、それらも一緒に削除されます。この操作は元に戻すことができません。
          </ModalDescription>
        </ModalHeader>
        {gradeWarning && (
          <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-sm whitespace-pre-line text-orange-800">
            {gradeWarning}
          </div>
        )}
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            // 使われているかを調べ終わるまでは押させない（影響を見せる前に消さない）
            disabled={cropRegionId !== null && gradeReferences.isPending}
          >
            削除する
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
