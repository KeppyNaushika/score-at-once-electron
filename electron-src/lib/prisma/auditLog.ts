/**
 * @fileoverview 監査ログ記録サービス
 * @description Discord風監査ログの追記専用書き込み。各mutationから明示的に呼ぶ。
 *   記録は「ベストエフォート」: 失敗しても主操作を壊さないよう例外を握りつぶす
 *   （ログ欠落 < 主操作の失敗）。アクション定義は auditActions.ts を参照。
 */

import {
  type AuditActionKey,
  buildAuditSummary,
  getAuditActionDef,
} from "./auditActions"
import { getCurrentActorUserId } from "./auditActor"
import prisma from "./client"
import type { Tx } from "./transactionClient"

/** 単一フィールドの変更（before→after 差分） */
export interface AuditChange {
  field: string
  /** UI表示用の日本語ラベル（省略時は field を表示） */
  label?: string
  before: unknown
  after: unknown
}

interface RecordAuditLogInput {
  /** アクションキー（カタログ参照。型補完のため AuditActionKey を推奨） */
  action: AuditActionKey | (string & {})
  /**
   * 操作者ID。未指定（undefined）の場合は認証ストアから現在の操作者を自動補完する。
   * システム操作として明示的に actor 無しにしたい場合は null を渡す。
   */
  userId?: string | null
  /** 変更対象のテーブル名 */
  entityType: string
  /** 変更対象のレコードID */
  entityId: string
  /** 絞り込み用の親エンティティID（examId / gradeId / definitionId 等） */
  scopeId?: string | null
  /** 表示用スナップショット（対象作業領域のラベル。"数学 期末" 等） */
  scopeLabel?: string | null
  /** 対象ラベル（サマリ生成用。生徒名・設問名等） */
  target?: string | null
  /** before→after の差分（更新系で使用） */
  changes?: AuditChange[]
  /** metadata に追加する任意情報 */
  extra?: Record<string, unknown>
  /** 明示指定すればこのサマリを使う（省略時はカタログから自動生成） */
  summary?: string
  /**
   * 連続操作の集約キー。指定すると、時間窓内の同一キー・同一操作者の既存行があれば
   * 新規挿入せず、その行の changes を束ね直し（`mergeCoalescedChanges`）＋ occurrences を
   * 加算＋ updatedAt を更新する。
   * （例: "annotation.update:<注釈id>:<操作者>"）
   */
  coalesceKey?: string
  /** トランザクション内で記録する場合に渡す */
  tx?: Tx
}

/** 連続操作とみなす集約の時間窓（ミリ秒） */
const COALESCE_WINDOW_MS = 5 * 60_000

/**
 * 監査ログを1件記録する。
 * 失敗しても例外を投げない（主操作を妨げないため、エラーはログ出力のみ）。
 */
export async function recordAuditLog(
  input: RecordAuditLogInput
): Promise<void> {
  try {
    const def = getAuditActionDef(input.action)
    // userId 未指定なら認証ストアから現在の操作者を補完（明示的な null はそのまま尊重）
    const userId =
      input.userId !== undefined ? input.userId : getCurrentActorUserId()
    const summary =
      input.summary ?? buildAuditSummary(input.action, input.target)

    const client = input.tx ?? prisma

    // 連続操作の集約: 時間窓内に同一キー・同一操作者の行があれば上書き更新する。
    // coalesceKey はインデックス付き専用カラムなので一致検索は高速。
    if (input.coalesceKey) {
      const windowStart = new Date(Date.now() - COALESCE_WINDOW_MS)
      const match = await client.auditLog.findFirst({
        where: {
          coalesceKey: input.coalesceKey,
          userId: userId ?? null,
          updatedAt: { gte: windowStart },
        },
        orderBy: { updatedAt: "desc" },
      })
      if (match) {
        const meta = JSON.parse(match.metadata ?? "{}") as {
          changes?: AuditChange[]
          occurrences?: number
          [key: string]: unknown
        }
        meta.occurrences = (meta.occurrences ?? 1) + 1
        if (input.changes && input.changes.length > 0) {
          meta.changes = mergeCoalescedChanges(meta.changes, input.changes)
        }
        // updatedAt は @updatedAt により自動更新される
        await client.auditLog.update({
          where: { id: match.id },
          data: { metadata: JSON.stringify(meta) },
        })
        return
      }
    }

    const metadataObj: Record<string, unknown> = {}
    if (input.changes && input.changes.length > 0) {
      metadataObj.changes = input.changes
    }
    if (input.target) {
      metadataObj.target = { type: input.entityType, label: input.target }
    }
    if (input.coalesceKey) {
      metadataObj.occurrences = 1
    }
    if (input.extra) {
      Object.assign(metadataObj, input.extra)
    }
    const metadata =
      Object.keys(metadataObj).length > 0 ? JSON.stringify(metadataObj) : null

    await client.auditLog.create({
      data: {
        action: input.action,
        category: def.category,
        userId: userId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        scopeId: input.scopeId ?? null,
        scopeLabel: input.scopeLabel ?? null,
        summary,
        metadata,
        coalesceKey: input.coalesceKey ?? null,
      },
    })
  } catch (error) {
    // ベストエフォート: 記録失敗は主操作を壊さない
    console.error("recordAuditLog failed:", input.action, error)
  }
}

/**
 * 連続操作を1行へまとめるときの changes の束ね方。
 *
 * まとめた行が表すのは「最初の操作の前 → 最後の操作の後」。項目（field）ごとに
 * before は既存行の値（初回の値）を保ち、after だけを今回の値で置き換える。
 * 今回初めて変わった項目は今回の before をそのまま使って足す（それより前の操作では
 * 変わっていないので、今回の before が初回時点の値でもある）。今回触れなかった
 * 項目は既存行のまま残す。
 */
export function mergeCoalescedChanges(
  existing: AuditChange[] | undefined,
  incoming: AuditChange[]
): AuditChange[] {
  const merged = [...(existing ?? [])]
  for (const change of incoming) {
    const index = merged.findIndex((prev) => prev.field === change.field)
    if (index === -1) {
      merged.push(change)
    } else {
      merged[index] = { ...merged[index], after: change.after }
    }
  }
  return merged
}

/**
 * 監視対象フィールドの before→after を比較し、変化した項目のみ AuditChange[] を返す。
 * 値の比較は JSON 文字列化による浅い等価判定（プリミティブ/日付/単純オブジェクト向け）。
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T | null | undefined,
  after: T | null | undefined,
  watched: Array<{ field: keyof T & string; label?: string }>
): AuditChange[] {
  const changes: AuditChange[] = []
  for (const { field, label } of watched) {
    const beforeValue = before?.[field]
    const afterValue = after?.[field]
    if (!isEqual(beforeValue, afterValue)) {
      changes.push({
        field,
        label,
        before: beforeValue ?? null,
        after: afterValue ?? null,
      })
    }
  }
  return changes
}

const isEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) return true
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime()
  }
  // null/undefined を同一視
  if (a == null && b == null) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}
