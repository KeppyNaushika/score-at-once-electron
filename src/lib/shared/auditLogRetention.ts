/**
 * 操作履歴（監査ログ）を残す日数。
 *
 * 値は設定（`AppPreference`）に持ち、**DB を共有する全員で1つ**。端末ごとに違う値を
 * 持つと、短い方の端末が消した行が同期で全端末から消える一方、長い方の端末は消さない
 * ので、どこまで残るかが端末の起動順で決まってしまう。
 *
 * 起動時の整理（main の `pruneAuditLogs`）と設定画面（renderer）の両方が引くので
 * `src/lib/shared/` に置く。
 */

/** 残す日数を持つ設定のキー（`AppPreference.key`） */
export const AUDIT_LOG_RETENTION_DAYS_KEY = "auditLogRetentionDays"

/**
 * 選べる日数。容量の見積もり（生徒180・試験10・40問・教員30）は
 * 90日 36MB / 180日 72MB / 365日 145MB / 730日 290MB（docs/audit-log-redesign.md §保持期間）
 */
export const AUDIT_LOG_RETENTION_DAYS_CHOICES = [90, 180, 365, 730] as const

/** 設定が無いときの日数 */
export const DEFAULT_AUDIT_LOG_RETENTION_DAYS = 365

/**
 * 保存されている JSON 文字列を読む。**壊れていれば既定として扱う。**
 *
 * 選択肢に無い日数でも、正の整数なら受け付ける（選択肢を後から変えても、保存済みの
 * 値で消える範囲が変わらないように）。
 */
export function parseAuditLogRetentionDays(storedText: string | null): number {
  if (storedText === null) return DEFAULT_AUDIT_LOG_RETENTION_DAYS
  try {
    const parsed: unknown = JSON.parse(storedText)
    if (
      typeof parsed !== "number" ||
      !Number.isInteger(parsed) ||
      parsed <= 0
    ) {
      return DEFAULT_AUDIT_LOG_RETENTION_DAYS
    }
    return parsed
  } catch {
    return DEFAULT_AUDIT_LOG_RETENTION_DAYS
  }
}

/** 日数の見せ方（365日 → 1年） */
export function formatAuditLogRetentionDays(days: number): string {
  if (days % 365 === 0) return `${days / 365}年`
  return `${days}日`
}
