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
 *
 * 作業領域と同じ名前のラベルは出さない。試験の作成・編集のように作業領域そのものが
 * 対象の行では、隣に出す作業領域名と同じ名前が2度並ぶだけになる。
 */
export function displayTargetLabels(
  log: AuditLogRow,
  metadata: AuditMetadata
): string[] {
  const isScopeLabel = (label: string) => label === log.scopeLabel
  if (log.targets.length === 0) {
    return metadata.target && !isScopeLabel(metadata.target.label)
      ? [metadata.target.label]
      : []
  }
  const labelByKey = new Map<string, string>()
  for (const target of log.targets) {
    const key = `${target.targetType}\u0000${target.targetId}`
    if (!labelByKey.has(key) && target.targetLabel) {
      labelByKey.set(key, target.targetLabel)
    }
  }
  return [...labelByKey.values()].filter((label) => !isScopeLabel(label))
}

/**
 * 作業領域の行き先（パスの頭）。**action の接頭辞で決める**（`category` では決められない —
 * `coursework.*` は `category: "grade"` に分類されている。docs/audit-log-redesign.md §リンク）。
 */
const SCOPE_PATH_BY_ACTION_PREFIX: Record<string, string> = {
  exam: "/exams",
  grade: "/grades",
  coursework: "/coursework",
  answer_sheet: "/answer-sheet-builder",
  class: "/classrooms",
}

/** 接頭辞では決まらないもの。小計グループの選択は試験の作業領域に記録している */
const SCOPE_PATH_BY_ACTION: Record<string, string> = {
  "subtotal_group.selection_update": "/exams",
}

/**
 * 行の作業領域（試験・成績算出など）の詳細ページへのパス。行き先が無ければ null。
 *
 * 作業領域そのものを削除した行（`exam.delete` など）には付けない（行き先が無いと
 * 行から分かる）。それ以外で後から消えた作業領域は確かめない（行ごとに問い合わせる
 * ことになる。行き先が無ければ開いた先で分かる）。
 */
export function auditLogScopeHref(log: AuditLogRow): string | null {
  if (!log.scopeId) return null
  const actionPrefix = log.action.split(".")[0]
  if (log.action === `${actionPrefix}.delete`) return null
  const scopePath =
    SCOPE_PATH_BY_ACTION[log.action] ??
    SCOPE_PATH_BY_ACTION_PREFIX[actionPrefix]
  return scopePath ? `${scopePath}/${log.scopeId}` : null
}
