import {
  AUDIT_LOG_RETENTION_DAYS_KEY,
  formatAuditLogRetentionDays,
  parseAuditLogRetentionDays,
} from "@/lib/shared/auditLogRetention"

import { recordAuditLog } from "./auditLog"
import prisma from "./client"

/**
 * アプリ全体の設定（KV方式）の読み書き。
 *
 * 利用者ごとの好みは `userSettings.ts` の側。ここに置くのは **DB を共有する全員で
 * 同じであるべき決めごと**で、いまは年度の開始日と、操作履歴を残す日数である。
 */

/** 1キー分。行が無ければ null（呼び手が既定を決める） */
export async function getAppPreference(key: string): Promise<string | null> {
  const record = await prisma.appPreference.findUnique({ where: { key } })
  return record?.value ?? null
}

/**
 * 1キー分を書く。
 *
 * `key` は主キーではないので、別の端末が同じキーを同時に作ると id の違う行が2つできる。
 * 子を持たない表なので、同期はそれを後勝ちで畳める。
 */
export async function setAppPreference(
  key: string,
  value: string
): Promise<void> {
  await prisma.appPreference.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}

/** 操作履歴を残す日数（起動時の整理が使う）。設定が無い・壊れていれば既定 */
export async function getAuditLogRetentionDays(): Promise<number> {
  return parseAuditLogRetentionDays(
    await getAppPreference(AUDIT_LOG_RETENTION_DAYS_KEY)
  )
}

/**
 * 操作履歴を残す日数を変える。**変えたこと自体を操作履歴に残す**
 * （残さないと「なぜ去年の記録が無いのか」を後から追えない）。
 *
 * 汎用の `setAppPreference` を通さないのは、この記録を書くため。
 */
export async function setAuditLogRetentionDays(days: number): Promise<void> {
  if (!Number.isInteger(days) || days <= 0) {
    throw new Error(`操作履歴を残す日数が正しくありません: ${days}`)
  }
  const before = await getAuditLogRetentionDays()
  await setAppPreference(AUDIT_LOG_RETENTION_DAYS_KEY, JSON.stringify(days))
  if (before === days) return
  await recordAuditLog({
    action: "system.audit_log_retention.update",
    entityType: "AppPreference",
    entityId: AUDIT_LOG_RETENTION_DAYS_KEY,
    changes: [
      {
        field: "retentionDays",
        label: "残す期間",
        before: formatAuditLogRetentionDays(before),
        after: formatAuditLogRetentionDays(days),
      },
    ],
  })
}
