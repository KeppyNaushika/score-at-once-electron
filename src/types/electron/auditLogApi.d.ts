/**
 * 監査ログ API 型定義（Discord風 操作履歴）
 *
 * lib（electron-src/lib/prisma/audit*.ts）を SSOT とし、契約となる型は
 * そこから import する。renderer 側の精緻化（metadata の構造化）だけは
 * ここで型注入して維持する。
 *
 * 注: AuditCategory / AuditVerb / AuditChange / AuditLogFilter /
 *     AuditLogQueryOptions / AuditScopeFacet を使う消費者は、
 *     再エクスポート禁止のため各 lib モジュールから直接 import すること。
 */

import type { AuditChange } from "@/electron-src/lib/prisma/auditLog"
import type {
  AuditLogEntry as BaseAuditLogEntry,
  AuditLogPage as BaseAuditLogPage,
  AuditLogQueryOptions,
  AuditScopeFacet,
} from "@/electron-src/lib/prisma/auditQuery"

/** metadata のパース済み構造（renderer 独自の精緻化） */
export interface AuditMetadata {
  changes?: AuditChange[]
  target?: { type: string; label: string }
  occurrences?: number
  coalesceKey?: string
  [key: string]: unknown
}

/**
 * 1件分の監査ログ（renderer 版）。
 * lib 版の緩い `metadata: Record<string, unknown> | null` を
 * 構造化した `AuditMetadata | null` に差し替える。
 */
export interface AuditLogEntry extends Omit<BaseAuditLogEntry, "metadata"> {
  metadata: AuditMetadata | null
}

/** 監査ログの1ページ（entries を renderer 版 AuditLogEntry に差し替え） */
export interface AuditLogPage extends Omit<BaseAuditLogPage, "entries"> {
  entries: AuditLogEntry[]
}

export interface AuditLogAPI {
  audit: {
    getLogs(options?: AuditLogQueryOptions): Promise<AuditLogPage>
    getScopes(): Promise<AuditScopeFacet[]>
  }
}
