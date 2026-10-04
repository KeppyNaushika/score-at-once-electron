/**
 * 監査ログの行から、表示に要る値を導く。
 *
 * main は行をそのまま返す（`auditQuery.ts`）。種別（verb）・集約回数・変更内容は
 * ここで行から読む。カテゴリは行の `category` 列をそのまま使う（カタログから
 * 引き直すと、DB の列とカタログの2つの真実ができる）。
 */

import type { AuditChange } from "@/electron-src/lib/prisma/auditLog"
import type { AuditLogRow, AuditMetadata } from "@/types/auditLog.types"

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isAuditChange = (value: unknown): value is AuditChange =>
  isRecord(value) &&
  typeof value.field === "string" &&
  (value.label === undefined || typeof value.label === "string") &&
  "before" in value &&
  "after" in value

/**
 * metadata 列（JSON 文字列）を読む。読めない・形の違う部分は無いものとして扱う
 * （記録はベストエフォートで、古い行や手で直した行が混ざりうる）。
 */
export function parseAuditMetadata(metadata: string | null): AuditMetadata {
  if (!metadata) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(metadata)
  } catch {
    return {}
  }
  if (!isRecord(parsed)) return {}
  const { changes, target, occurrences } = parsed
  return {
    changes: Array.isArray(changes) ? changes.filter(isAuditChange) : undefined,
    target:
      isRecord(target) &&
      typeof target.type === "string" &&
      typeof target.label === "string"
        ? { type: target.type, label: target.label }
        : undefined,
    occurrences: typeof occurrences === "number" ? occurrences : undefined,
  }
}

/**
 * 表示する対象。同じ対象が2度付いている行（同じ生徒を2度渡した等）は1つにまとめる。
 * 対象が付いていない過去の行は、記録時に残した metadata の対象ラベルを出す。
 */
export function displayTargetLabels(
  log: AuditLogRow,
  metadata: AuditMetadata
): string[] {
  if (log.targets.length === 0) {
    return metadata.target ? [metadata.target.label] : []
  }
  const labelByKey = new Map<string, string>()
  for (const target of log.targets) {
    const key = `${target.targetType}\u0000${target.targetId}`
    if (!labelByKey.has(key) && target.targetLabel) {
      labelByKey.set(key, target.targetLabel)
    }
  }
  return [...labelByKey.values()]
}
