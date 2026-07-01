/**
 * 監査ログ API 型定義（Discord風 操作履歴）
 *
 * electron-src/lib/prisma/auditQuery.ts および auditActions.ts と対応する
 * フロントエンド側の契約。
 */

export type AuditCategory =
  "exam" | "grade" | "answer_sheet" | "student" | "user" | "system"

export type AuditVerb =
  "create" | "update" | "delete" | "export" | "import" | "other"

/** before→after の単一フィールド差分 */
export interface AuditChange {
  field: string
  label?: string
  before: unknown
  after: unknown
}

/** metadata のパース済み構造 */
export interface AuditMetadata {
  changes?: AuditChange[]
  target?: { type: string; label: string }
  occurrences?: number
  coalesceKey?: string
  [key: string]: unknown
}

/** 1件分の監査ログ（操作者情報・カテゴリ・verb付与済み） */
export interface AuditLogEntry {
  id: string
  createdAt: string
  updatedAt: string
  occurrences: number
  action: string
  category: AuditCategory
  verb: AuditVerb
  userId: string | null
  actorName: string | null
  actorUsername: string | null
  entityType: string
  entityId: string
  scopeId: string | null
  scopeLabel: string | null
  summary: string
  metadata: AuditMetadata | null
}

export interface AuditLogFilter {
  userId?: string
  category?: AuditCategory
  action?: string
  scopeId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

export interface AuditLogQueryOptions extends AuditLogFilter {
  limit?: number
  offset?: number
}

export interface AuditLogPage {
  entries: AuditLogEntry[]
  total: number
  limit: number
  offset: number
}

export interface AuditScopeFacet {
  scopeId: string
  scopeLabel: string | null
  category: string
}

export interface AuditLogAPI {
  audit: {
    getLogs(options?: AuditLogQueryOptions): Promise<AuditLogPage>
    getScopes(): Promise<AuditScopeFacet[]>
  }
}
