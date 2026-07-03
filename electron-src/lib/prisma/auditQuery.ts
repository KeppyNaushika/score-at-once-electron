/**
 * @fileoverview 監査ログ取得サービス
 * @description Discord風監査ログの読み出し。フィルタ・ページネーションに対応し、
 *   操作者（actor）の表示情報をサーバー側で付与して返す。
 */

import type { Prisma } from "@prisma/client"

import {
  type AuditCategory,
  type AuditVerb,
  getAuditActionDef,
} from "./auditActions"
import prisma from "./client"

export interface AuditLogFilter {
  userId?: string
  category?: AuditCategory
  /** 完全一致のアクションキー */
  action?: string
  /** 親エンティティID（特定の試験・成績などに絞る） */
  scopeId?: string
  /** ISO文字列。この日時以降 */
  dateFrom?: string
  /** ISO文字列。この日時以前 */
  dateTo?: string
  /** サマリ部分一致 */
  search?: string
}

export interface AuditLogQueryOptions extends AuditLogFilter {
  /** 取得件数（既定50、最大200） */
  limit?: number
  /** オフセット（既定0） */
  offset?: number
}

/** UIへ返す1件分の監査ログ（操作者情報・カテゴリ・verbを付与済み） */
export interface AuditLogEntry {
  id: string
  createdAt: string // ISO（初回操作時刻）
  updatedAt: string // ISO（最終更新時刻。集約された場合は createdAt より後）
  occurrences: number // 集約回数（連続操作のまとめ件数。1なら単発）
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
  /** パース済み metadata（changes / target 等） */
  metadata: Record<string, unknown> | null
}

export interface AuditLogPage {
  entries: AuditLogEntry[]
  total: number
  limit: number
  offset: number
}

const buildWhere = (filter: AuditLogFilter): Prisma.AuditLogWhereInput => {
  const where: Prisma.AuditLogWhereInput = {}
  if (filter.userId) where.userId = filter.userId
  if (filter.category) where.category = filter.category
  if (filter.action) where.action = filter.action
  if (filter.scopeId) where.scopeId = filter.scopeId
  if (filter.search) where.summary = { contains: filter.search }
  if (filter.dateFrom || filter.dateTo) {
    const createdAt: Prisma.DateTimeFilter = {}
    if (filter.dateFrom) createdAt.gte = new Date(filter.dateFrom)
    if (filter.dateTo) createdAt.lte = new Date(filter.dateTo)
    where.createdAt = createdAt
  }
  return where
}

const parseMetadata = (raw: string | null): Record<string, unknown> | null => {
  if (!raw) return null
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * 監査ログをフィルタ・ページネーションして取得する。
 * 操作者名は userId からまとめて解決して付与する。
 */
export async function getAuditLogs(
  options: AuditLogQueryOptions = {}
): Promise<AuditLogPage> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200)
  const offset = Math.max(options.offset ?? 0, 0)
  const where = buildWhere(options)

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where }),
  ])

  // 操作者情報を一括解決
  const userIds = Array.from(
    new Set(rows.map((row) => row.userId).filter((id): id is string => !!id))
  )
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, username: true },
        })
      : []
  const userMap = new Map(users.map((user) => [user.id, user]))

  const toIso = (v: Date | string): string =>
    v instanceof Date ? v.toISOString() : String(v)

  const entries: AuditLogEntry[] = rows.map((row) => {
    const def = getAuditActionDef(row.action)
    const actor = row.userId ? userMap.get(row.userId) : undefined
    const metadata = parseMetadata(row.metadata)
    const occurrences =
      typeof metadata?.occurrences === "number" ? metadata.occurrences : 1
    return {
      id: row.id,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
      occurrences,
      action: row.action,
      category: def.category,
      verb: def.verb,
      userId: row.userId,
      actorName: actor?.name ?? null,
      actorUsername: actor?.username ?? null,
      entityType: row.entityType,
      entityId: row.entityId,
      scopeId: row.scopeId,
      scopeLabel: row.scopeLabel,
      summary: row.summary,
      metadata,
    }
  })

  return { entries, total, limit, offset }
}

/** フィルタUI用のファセット（出現したscopeの一覧をカテゴリ別に返す） */
export interface AuditScopeFacet {
  scopeId: string
  scopeLabel: string | null
  category: string
}

export async function getAuditLogScopes(): Promise<AuditScopeFacet[]> {
  const rows = await prisma.auditLog.findMany({
    where: { scopeId: { not: null } },
    distinct: ["scopeId"],
    select: { scopeId: true, scopeLabel: true, category: true },
    orderBy: { createdAt: "desc" },
  })
  return rows
    .filter(
      (
        row
      ): row is {
        scopeId: string
        scopeLabel: string | null
        category: string
      } => !!row.scopeId
    )
    .map((row) => ({
      scopeId: row.scopeId,
      scopeLabel: row.scopeLabel,
      category: row.category,
    }))
}

/** 監査ログの既定保持日数（これより古いエントリは起動時プルーニングの対象） */
export const DEFAULT_AUDIT_RETENTION_DAYS = 730 // 2年

/**
 * 保持期間を超えた監査ログを削除する（無制限な肥大化の防止）。
 *
 * 注意（同期との関係）: AuditLog は同期設定で deleteProtected のため、
 * ローカル削除は他端末/NASへ伝播せず、再同期で復活し得る。
 * 本プルーニングは「各端末でローカルに古い行を整理する」ベストエフォートであり、
 * 全端末が同じ保持日数で実行することで実質的に収束する。
 * 失敗しても起動を妨げないよう、呼び出し側で例外を握りつぶすこと。
 *
 * @returns 削除した件数
 */
export async function pruneAuditLogs(
  retentionDays: number = DEFAULT_AUDIT_RETENTION_DAYS
): Promise<number> {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return 0
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  const result = await prisma.auditLog.deleteMany({
    where: { updatedAt: { lt: cutoff } },
  })
  if (result.count > 0) {
    console.info(
      `pruneAuditLogs: ${result.count}件の監査ログ（${retentionDays}日より前）を削除しました`
    )
  }
  return result.count
}
