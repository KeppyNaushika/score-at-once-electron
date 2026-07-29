import { toast } from "sonner"

/**
 * 次のステップへの遷移チェック
 * レイアウトが保存されているかを確認
 *
 * @param layoutId - レイアウトの保存状態ID
 * @returns boolean - 次のステップに進めるかどうか
 */
export function canProceedToNextStep(layoutId: string | undefined): boolean {
  if (!layoutId) {
    toast.error("採点枠が保存されていません。まず採点枠を保存してください。")
    return false
  }
  return true
}
