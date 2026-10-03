"use client"

import { useEffect } from "react"

import { showSyncToast } from "@/components/common/syncNoticeToast"
import {
  describeSyncWarnings,
  newlyAppearedWarnings,
} from "@/lib/shared/syncWarningMessages"
import { subscribeSyncStatus } from "@/queries/sync"

/**
 * 同期が**新しく出した**注意書きを、気づける形で1度だけ知らせる。
 *
 * ライブラリは、注意書きを「アプリケーションの利用者に見える場所へ出すこと」としている。
 * ただし同じ注意は原因が続くかぎり同期のたびに出るので、**トーストだけに載せない**。
 * 消えない置き場は設定画面の同期タブ（「直近の同期で出た注意」）で、ここはその一覧を
 * 見に行くきっかけを作るだけの窓である。取りこぼしを気にしない。
 *
 * 新しく出たかどうかはここで見分ける。main は同期の状態（直近1回ぶんの注意の全文）を
 * そのまま押し出してくるだけで、前回との差を取らない。
 *
 * 描くものは無い。窓が開いている間ずっと聞いていられるよう AppShell に置く。
 */
export function SyncWarningNotifier() {
  useEffect(() => {
    let previousWarnings: string[] = []
    return subscribeSyncStatus((status) => {
      const newWarnings = newlyAppearedWarnings(
        previousWarnings,
        status.lastWarnings
      )
      previousWarnings = status.lastWarnings
      showWarningToast(newWarnings)
    })
  }, [])

  return null
}

/**
 * 新しく出た注意を1つのトーストにまとめる。
 *
 * 1回の同期で何種類も出ることがあり、種類ごとに窓を出すと画面が埋まる。手当てが要る
 * ものが混ざっていれば警告として、報告だけなら情報として出す。
 */
function showWarningToast(newWarnings: string[]): void {
  const notices = describeSyncWarnings(newWarnings)
  if (notices.length === 0) return

  const body = notices
    .map((notice) =>
      notice.count > 1
        ? `${notice.message}（${notice.count}件）`
        : notice.message
    )
    .join("\n")
  const needsAttention = notices.some((notice) => notice.severity === "warning")
  showSyncToast(
    needsAttention ? "warning" : "info",
    "同期から注意が出ています",
    `${body}\n設定 › 同期設定 で全文を確認できます。`
  )
}
