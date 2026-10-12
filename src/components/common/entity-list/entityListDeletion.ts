import { toast } from "sonner"

interface EntityListDeletion {
  /** 消す書き込み（`mutateAsync`）。失敗は投げる */
  remove: () => Promise<unknown>
  /** 確認窓を閉じる */
  closeDialog: () => void
  /** 成功のトーストの見出し（「資料を削除しました」など） */
  successMessage: string
  /** 消した行の名前（トーストの本文） */
  entityName: string
}

/**
 * 一覧の確認窓から1件消す。
 *
 * - **失敗したら窓は開いたまま。** 失敗の通知は書き込みの宣言（`meta.errorMessage`）を
 *   見て `MutationCache` が出すので、ここでは出さない（出すと二重になる）
 * - 成功したら窓を閉じ、何を消したかをトーストで知らせる
 *
 * 消した行の id は選択に残るが、`useEntityListControls` が今の行に無い id を選択から
 * 落とすので、ここで選択を触る必要は無い。
 */
export async function deleteFromEntityList({
  remove,
  closeDialog,
  successMessage,
  entityName,
}: EntityListDeletion): Promise<void> {
  try {
    await remove()
  } catch {
    return
  }
  closeDialog()
  toast.success(successMessage, { description: entityName })
}
