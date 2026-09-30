"use client"

import { useEffect } from "react"
import { toast } from "sonner"

import { BETA_ORIGIN_PREFIX } from "@/components/common/BetaBadge"
import type { SyncWarningReport } from "@/electron-src/lib/sync/types"
import { describeSyncWarnings } from "@/lib/shared/syncWarningMessages"
import { subscribeSyncWarningsChanged } from "@/queries/sync"

/**
 * 同期が**新しく出した**注意書きを、気づける形で1度だけ知らせる。
 *
 * ライブラリは、注意書きを「アプリケーションの利用者に見える場所へ出すこと」としている。
 * ただし同じ注意は原因が続くかぎり同期のたびに出るので、**トーストだけに載せない**。
 * 消えない置き場は設定画面の同期タブ（「直近の同期で出た注意」）で、ここはその一覧を
 * 見に行くきっかけを作るだけの窓である。だから main は新しく出たぶんだけを押し出し、
 * ここも取りこぼしを気にしない。
 *
 * 描くものは無い。窓が開いている間ずっと聞いていられるよう AppShell に置く。
 */
export function SyncWarningNotifier() {
  useEffect(() => subscribeSyncWarningsChanged(showWarningToast), [])

  return null
}

/**
 * 新しく出た注意を1つのトーストにまとめる。
 *
 * 1回の同期で何種類も出ることがあり、種類ごとに窓を出すと画面が埋まる。手当てが要る
 * ものが混ざっていれば警告として、報告だけなら情報として出す。
 * 自動で消えると見落とすため、閉じるまで残す。
 */
function showWarningToast(report: SyncWarningReport): void {
  const notices = describeSyncWarnings(report.newWarnings)
  if (notices.length === 0) return

  const body = notices
    .map((notice) =>
      notice.count > 1
        ? `${notice.message}（${notice.count}件）`
        : notice.message
    )
    .join("\n")
  const description = `${body}\n設定 › 同期設定 で全文を確認できます。`
  const title = `${BETA_ORIGIN_PREFIX}同期から注意が出ています`

  const needsAttention = notices.some((notice) => notice.severity === "warning")
  if (needsAttention) {
    toast.warning(title, {
      description,
      duration: Infinity,
      closeButton: true,
    })
    return
  }
  toast.info(title, { description, duration: Infinity, closeButton: true })
}
