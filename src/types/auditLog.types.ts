/**
 * 監査ログの renderer 版型。
 *
 * 行は main が返したまま（`AuditLogWithTargets`、境界で `Serialized<>`）を持つ。
 * 操作者名・種別・集約回数は renderer が行から導く（`audit-logs/auditLogRow.ts`）。
 */

import type { AuditChange } from "@/electron-src/lib/prisma/auditLog"
import type { AuditLogWithTargets } from "@/electron-src/lib/prisma/auditQuery"
import type { Serialized } from "@/types/prismaExtensions"

/** 境界を越えた監査ログ1行（対象 `targets` つき） */
export type AuditLogRow = Serialized<AuditLogWithTargets>

/** metadata（JSON 文字列の列）を読んだ形。DB には保存しない表示用の構造 */
export interface AuditMetadata {
  changes?: AuditChange[]
  target?: { type: string; label: string }
  occurrences?: number
}
