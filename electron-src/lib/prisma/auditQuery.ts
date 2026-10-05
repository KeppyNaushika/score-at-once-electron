/**
 * @fileoverview 監査ログ取得サービス
 * @description 監査ログの読み出し。絞り込み・ページ送り・総件数だけを main で行い、
 *   **行は射影せずそのまま**（対象 `targets` を include して）返す。
 *
 *   ここは「計算は renderer 側」規約に対する、所有者が名指しで認めた例外である
 *   （`docs/coding-style.md` の例外一覧）。監査ログは保持日数のぶん積み上がり、全行を
 *   renderer へ渡せないため。認められているのは `where` / `orderBy` / `take` / `skip` /
 *   `count` / 選択肢の `distinct` だけで、**行の射影・関連の平坦化・表示値の導出・表示の
 *   ための集計はしない**（操作者名・種別・集約回数は renderer が行から導く）。
 *   例外を負うのはこのファイルの `getAuditLogs` / `getAuditLogScopes` の2関数だけ。
 */

import { Prisma } from "@prisma/client"

import type { AuditCategory, AuditTargetType } from "@/lib/shared/auditActions"

import prisma from "./client"

/** 対象1つでの絞り込み（`AuditLogTarget` の種類と id） */
export interface AuditLogTargetFilter {
  targetType: AuditTargetType
  targetId: string
}

export interface AuditLogFilter {
  userId?: string
  category?: AuditCategory
  /**
   * アクションキーの集合（どれかに一致）。操作種別（verb）での絞り込みは renderer が
   * ここへ展開して渡す（DB に verb の列は無い）。空の配列は何にも一致しない
   */
  actions?: string[]
  /** 親エンティティID（特定の試験・成績などに絞る） */
  scopeId?: string
  /** 対象（生徒・採点領域など）。複数あれば、すべてを対象に持つログだけ */
  targets?: AuditLogTargetFilter[]
  /** ISO文字列。最後の操作がこの日時以降 */
  dateFrom?: string
  /** ISO文字列。最後の操作がこの日時以前 */
  dateTo?: string
  /** サマリ部分一致（空白は全角・半角・無しを区別しない） */
  search?: string
}

/** 行と一緒に返す関連（対象）。行はこの形のまま renderer へ渡る */
const auditLogInclude = {
  targets: true,
} satisfies Prisma.AuditLogInclude

export type AuditLogWithTargets = Prisma.AuditLogGetPayload<{
  include: typeof auditLogInclude
}>

interface AuditLogPage {
  logs: AuditLogWithTargets[]
  total: number
  /** clamp 後の実効値 */
  limit: number
  /** clamp 後の実効値 */
  offset: number
}

const buildWhere = (filter: AuditLogFilter): Prisma.AuditLogWhereInput => {
  const where: Prisma.AuditLogWhereInput = {}
  if (filter.userId) where.userId = filter.userId
  if (filter.category) where.category = filter.category
  if (filter.actions) where.action = { in: filter.actions }
  if (filter.scopeId) where.scopeId = filter.scopeId
  if (filter.targets && filter.targets.length > 0) {
    where.AND = filter.targets.map((target) => ({
      targets: {
        some: { targetType: target.targetType, targetId: target.targetId },
      },
    }))
  }
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
 * 絞り込みの条件は `buildWhere` と同じものを SQL で書く。**どちらかに条件を足したら
 * もう片方にも足すこと**（検索語の有無で絞り込みの効き方が変わってしまう）。
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
  if (filter.actions) {
    conditions.push(
      filter.actions.length > 0
        ? Prisma.sql`"action" IN (${Prisma.join(filter.actions)})`
        : Prisma.sql`0 = 1`
    )
  }
  if (filter.scopeId) conditions.push(Prisma.sql`"scopeId" = ${filter.scopeId}`)
  for (const target of filter.targets ?? []) {
    conditions.push(
      Prisma.sql`EXISTS (SELECT 1 FROM "AuditLogTarget" WHERE "AuditLogTarget"."auditLogId" = "AuditLog"."id" AND "AuditLogTarget"."targetType" = ${target.targetType} AND "AuditLogTarget"."targetId" = ${target.targetId})`
    )
  }
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

/**
 * 監査ログを絞り込み、1ページ分の行（対象つき）と総件数を返す。
 *
 * 行はそのまま返す。操作者名（`userId` → 利用者一覧）・種別（`action` → カタログ）・
 * 集約回数（`metadata`）は renderer が導く。
 */
export async function getAuditLogs(
  filter: AuditLogFilter = {},
  requestedLimit = 50,
  requestedOffset = 0
): Promise<AuditLogPage> {
  const limit = Math.min(Math.max(requestedLimit, 1), 200)
  const offset = Math.max(requestedOffset, 0)
  const search = filter.search?.trim() ?? ""

  // 並びは最後の操作の時刻（updatedAt）の新しい順。一覧が表示する時刻も updatedAt
  // なので、まとめた行（occurrences > 1）も表示時刻の並びに収まる。createdAt で
  // 並べると、少し前に始めて今も続けている操作が、表示は「たった今」なのに
  // 下の方へ沈む。同時刻は id で順を決め、ページをまたいで行が揺れないようにする
  if (compactSearchTerm(search) === "") {
    const where = buildWhere(filter)
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: auditLogInclude,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ])
    return { logs, total, limit, offset }
  }

  const page = await searchAuditLogPage({ ...filter, search }, limit, offset)
  const pageLogs = await prisma.auditLog.findMany({
    where: { id: { in: page.ids } },
    include: auditLogInclude,
  })
  // in は順を守らないので、SQL が決めた並びへ戻す
  const logById = new Map(pageLogs.map((log) => [log.id, log]))
  return {
    logs: page.ids.flatMap((id) => logById.get(id) ?? []),
    total: page.total,
    limit,
    offset,
  }
}

/** 絞り込みの選択肢: ログに現れた作業領域（試験・成績など）。名前が変われば別の行になる */
export interface AuditScopeFacet {
  scopeId: string
  scopeLabel: string | null
  category: string
}

/**
 * 絞り込みの選択肢: ログに現れた対象。採点領域の候補に試験名を併記するため、
 * その対象が現れたログの作業領域も一緒に返す（同じ対象が作業領域の数だけ並ぶ）
 */
export interface AuditTargetFacet {
  targetType: string
  targetId: string
  targetLabel: string | null
  scopeId: string | null
  scopeLabel: string | null
}

/**
 * 絞り込みの選択肢（作業領域と対象）。引数なしで全件。
 *
 * **出どころはログ自身**（`CropRegion` などの表ではない）。削除済みの対象も候補に出し、
 * 削除のログをラベルで探してから、その対象の全ログを引けるようにするため。
 * Prisma の `distinct` は SQLite ではアプリ側で行う（全行を読む）ので、`SELECT DISTINCT`
 * を SQL で書く。
 */
export async function getAuditLogScopes(): Promise<{
  scopes: AuditScopeFacet[]
  targets: AuditTargetFacet[]
}> {
  const [scopes, targets] = await Promise.all([
    prisma.$queryRaw<AuditScopeFacet[]>`
      SELECT DISTINCT "scopeId", "scopeLabel", "category" FROM "AuditLog"
      WHERE "scopeId" IS NOT NULL`,
    prisma.$queryRaw<AuditTargetFacet[]>`
      SELECT DISTINCT
        "AuditLogTarget"."targetType" AS "targetType",
        "AuditLogTarget"."targetId" AS "targetId",
        "AuditLogTarget"."targetLabel" AS "targetLabel",
        "AuditLog"."scopeId" AS "scopeId",
        "AuditLog"."scopeLabel" AS "scopeLabel"
      FROM "AuditLogTarget"
      JOIN "AuditLog" ON "AuditLog"."id" = "AuditLogTarget"."auditLogId"`,
  ])
  return { scopes, targets }
}

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
export async function pruneAuditLogs(retentionDays: number): Promise<number> {
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
