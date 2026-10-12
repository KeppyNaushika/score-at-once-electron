import { toast } from "sonner"

/**
 * 取り込み警告（点数スキップ・参照先未検出など）があれば通知する。警告があれば true。
 * 自動で消えると見落とすため手動で閉じるまで表示し、全件を本文に載せる。
 */
export function toastImportWarnings(warnings: string[]): boolean {
  if (warnings.length === 0) return false
  toast.warning(
    `インポートは完了しましたが ${warnings.length} 件の警告があります`,
    {
      description: warnings.join("\n"),
      duration: Infinity,
      closeButton: true,
    }
  )
  return true
}
