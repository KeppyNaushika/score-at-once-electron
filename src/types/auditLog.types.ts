/**
 * 監査ログの renderer 版型。
 *
 * lib 版（`electron-src/lib/prisma/auditQuery`）の緩い
 * `metadata: Record<string, unknown> | null` を、画面が読む構造へ精緻化する。
 */

import type { AuditChange } from "@/electron-src/lib/prisma/auditLog"
import type {
  AuditLogEntry as BaseAuditLogEntry,
  AuditLogPage as BaseAuditLogPage,
} from "@/electron-src/lib/prisma/auditQuery"

/** metadata のパース済み構造 */
interface AuditMetadata {
  changes?: AuditChange[]
  target?: { type: string; label: string }
  occurrences?: number
  coalesceKey?: string
  [key: string]: unknown
}

/** 1件分の監査ログ */
export interface AuditLogEntry extends Omit<BaseAuditLogEntry, "metadata"> {
  metadata: AuditMetadata | null
}

/** 監査ログの1ページ */
interface AuditLogPage extends Omit<BaseAuditLogPage, "entries"> {
  entries: AuditLogEntry[]
}
