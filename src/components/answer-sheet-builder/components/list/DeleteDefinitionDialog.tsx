"use client"

import ConfirmationModal from "@/components/common/ConfirmationModal"

interface DeleteDefinitionDialogProps {
  open: boolean
  onClose: () => void
  /** 削除する解答用紙の名前（確認文に出す） */
  definitionName: string | undefined
  onConfirm: () => Promise<void>
  /** 削除の書き込みを送っている間（押し直して2回送らないよう、両方のボタンを止める） */
  loading: boolean
}

/** 解答用紙を削除する前の確認ダイアログ。成績算出・試験外成績資料と同じ確認の部品を使う */
export function DeleteDefinitionDialog({
  open,
  onClose,
  definitionName,
  onConfirm,
  loading,
}: DeleteDefinitionDialogProps) {
  return (
    <ConfirmationModal
      open={open}
      onClose={onClose}
      title="解答用紙を削除しますか？"
      description={`「${definitionName}」を削除します。この操作は取り消せません。`}
      confirmText="削除"
      variant="destructive"
      icon="trash"
      onConfirm={onConfirm}
      loading={loading}
    />
  )
}
