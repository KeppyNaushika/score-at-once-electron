/**
 * @fileoverview 監査ログ取得サービス
 * @description Discord風監査ログの読み出し。フィルタ・ページネーションに対応し、
 *   操作者（actor）の表示情報をサーバー側で付与して返す。
 */

import { Prisma } from "@prisma/client"

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
  /** ISO文字列。最後の操作がこの日時以降 */
  dateFrom?: string
  /** ISO文字列。最後の操作がこの日時以前 */
  dateTo?: string
  /** サマリ部分一致（空白は全角・半角・無しを区別しない） */
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

interface AuditLogPage {
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
  // 日時の絞り込みも、並びと表示に合わせて最後の操作の時刻（updatedAt）で見る
  if (filter.dateFrom || filter.dateTo) {
    const updatedAt: Prisma.DateTimeFilter = {}
    if (filter.dateFrom) updatedAt.gte = new Date(filter.dateFrom)
    if (filter.dateTo) updatedAt.lte = new Date(filter.dateTo)
    where.updatedAt = updatedAt
  }
  return where
}

/** 検索語から空白（全角・半角）を抜き、小文字にする。summary 側も SQL で同じ形へ寄せる */
const compactSearchTerm = (search: string): string =>
  search.replace(/\s+/g, "").toLowerCase()

/**
 * 検索語があるときの1ページ分の id と総数。
 *
 * **空白を抜いて比べる式は Prisma の where に書けない**（`contains` は列をそのまま
 * LIKE にかける）ので、絞り込み・並び・ページ分け・件数をここだけ SQL で行う。
 * 一致した id を全部集めて `in` で渡す形は採らない —— 「試験」のような語は
 * 数万件に当たり、SQLite の変数の上限に掛かる。返すのは1ページ分（最大200件）だけ。
 *
 * 並びは Prisma 側（`buildWhere` を使う経路）と同じ `updatedAt` の新しい順、同時刻は id。
 * 日時の比較は `julianday()` を通す。列は `+00:00` 付きの ISO で入っており、
 * `toISOString()` の `Z` とは文字列のままでは比べられない。
 */
const searchAuditLogPage = async (
  filter: AuditLogFilter & { search: string },
  limit: number,
  offset: number
): Promise<{ ids: string[]; total: number }> => {
  const escapedTerm = compactSearchTerm(filter.search).replace(
    /[\\%_]/g,
    (character) => `\\${character}`
  )
  // 全角空白は char(12288)。ソースに直に書くと見分けが付かない
  const conditions: Prisma.Sql[] = [
    Prisma.sql`lower(replace(replace("summary", ' ', ''), char(12288), '')) LIKE ${`%${escapedTerm}%`} ESCAPE '\\'`,
  ]
  if (filter.userId) conditions.push(Prisma.sql`"userId" = ${filter.userId}`)
  if (filter.category)
    conditions.push(Prisma.sql`"category" = ${filter.category}`)
  if (filter.action) conditions.push(Prisma.sql`"action" = ${filter.action}`)
  if (filter.scopeId) conditions.push(Prisma.sql`"scopeId" = ${filter.scopeId}`)
  if (filter.dateFrom)
    conditions.push(
      Prisma.sql`julianday("updatedAt") >= julianday(${new Date(filter.dateFrom).toISOString()})`
    )
  if (filter.dateTo)
    conditions.push(
      Prisma.sql`julianday("updatedAt") <= julianday(${new Date(filter.dateTo).toISOString()})`
    )
  const whereSql = Prisma.join(conditions, " AND ")

  const [idRows, countRows] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "AuditLog" WHERE ${whereSql}
      ORDER BY "updatedAt" DESC, "id" DESC
      LIMIT ${limit} OFFSET ${offset}`,
    prisma.$queryRaw<{ total: number | bigint }[]>`
      SELECT COUNT(*) AS "total" FROM "AuditLog" WHERE ${whereSql}`,
  ])
  return {
    ids: idRows.map((idRow) => idRow.id),
    total: Number(countRows[0]?.total ?? 0),
  }
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
  const search = options.search?.trim() ?? ""

  // 並びは最後の操作の時刻（updatedAt）の新しい順。一覧が表示する時刻も updatedAt
  // なので、まとめた行（occurrences > 1）も表示時刻の並びに収まる。createdAt で
  // 並べると、少し前に始めて今も続けている操作が、表示は「たった今」なのに
  // 下の方へ沈む。同時刻は id で順を決め、ページをまたいで行が揺れないようにする
  const { rows, total } =
    compactSearchTerm(search) === ""
      ? await (async () => {
          const where = buildWhere(options)
          const [pageRows, pageTotal] = await Promise.all([
            prisma.auditLog.findMany({
              where,
              orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
              take: limit,
              skip: offset,
            }),
            prisma.auditLog.count({ where }),
          ])
          return { rows: pageRows, total: pageTotal }
        })()
      : await (async () => {
          const page = await searchAuditLogPage(
            { ...options, search },
            limit,
            offset
          )
          const pageRows = await prisma.auditLog.findMany({
            where: { id: { in: page.ids } },
          })
          // in は順を守らないので、SQL が決めた並びへ戻す
          const rowById = new Map(pageRows.map((row) => [row.id, row]))
          return {
            rows: page.ids.flatMap((id) => rowById.get(id) ?? []),
            total: page.total,
          }
        })()

  // 操作者情報を一括解決
  const userIds = Array.from(
    new Set(rows.map((row) => row.userId).filter((id): id is string => !!id))
  )
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          // パスコードだけを落とす（機密除去。縮小射影ではない）
          omit: { passcode: true },
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
interface AuditScopeFacet {
  scopeId: string
  scopeLabel: string | null
  category: string
}

export async function getAuditLogScopes(): Promise<AuditScopeFacet[]> {
  const rows = await prisma.auditLog.findMany({
    where: { scopeId: { not: null } },
    distinct: ["scopeId"],
    orderBy: { createdAt: "desc" },
  })
  return rows
    .filter((row): row is typeof row & { scopeId: string } => !!row.scopeId)
    .map((row) => ({
      scopeId: row.scopeId,
      scopeLabel: row.scopeLabel,
      category: row.category,
    }))
}

/** 監査ログの既定保持日数（これより古いエントリは起動時プルーニングの対象） */
const DEFAULT_AUDIT_RETENTION_DAYS = 730 // 2年

/**
 * 保持期間を超えた監査ログを削除する（無制限な肥大化の防止）。
 *
 * 注意（同期との関係）: v0.20.0 までは AuditLog を同期設定で削除から守っていたため、
 * ここでの削除は他端末では効かず、同じ行を持つ相手から次の同期で戻ってきていた。
 * sqlite-nas-sync v0.21.0 でその設定ごと無くなり、**削除はそのまま他端末へ伝わる**。
 * どれか1台が整理すれば、その結果が全端末に行き渡る。
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
