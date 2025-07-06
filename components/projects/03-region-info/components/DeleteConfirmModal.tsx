"use client"

import { Button } from "@/components/ui/button"
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal"
import { AlertTriangle } from "lucide-react"

type DeleteConfirmModalProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export const DeleteConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
}: DeleteConfirmModalProps) => {
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
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            削除する
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}