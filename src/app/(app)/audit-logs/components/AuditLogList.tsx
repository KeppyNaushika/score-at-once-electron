"use client"

import { useQuery } from "@tanstack/react-query"
import { History } from "lucide-react"
import { useMemo } from "react"

import { ListPaginationFooter } from "@/components/common/ListPaginationFooter"
import PageHeader from "@/components/layout/PageHeader"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import type { AuditFilterState } from "@/lib/auditLogFilterQuery"
import { type PublicUser, userListQuery } from "@/queries/user"

import { useAuditLogs } from "../hooks/useAuditLogs"
import { AuditLogFilterBar } from "./AuditLogFilterBar"
import { AuditLogItem } from "./AuditLogItem"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_USERS: PublicUser[] = []

export function AuditLogList({
  initialFilter,
}: {
  /** 最初の絞り込み（URL から読んだもの。詳細ページの「操作履歴」から来たとき） */
  initialFilter: AuditFilterState
}) {
  const {
    logs,
    total,
    loading,
    error,
    filter,
    setFilter,
    pageNumber,
    pageSize,
    pageSizeChoice,
    pageCount,
    setPageNumber,
    setPageSizeChoice,
    viewportRef,
  } = useAuditLogs(initialFilter)

  // 操作者の名前と、操作者の絞り込みの候補（ログイン画面と同じ利用者一覧のキャッシュを共有する）
  const { data: users = EMPTY_USERS } = useQuery(userListQuery())
  const userById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users]
  )

  // 何件目から何件目までを見ているか（総件数は main が数えた値）
  const firstRowNumber = total === 0 ? 0 : (pageNumber - 1) * pageSize + 1
  const lastRowNumber = Math.min(total, pageNumber * pageSize)

  return (
    <div className="flex h-full flex-col">
      {/* 絞り込みはヘッダーに置く。スクロールするのはログの並びだけ */}
      <PageHeader title="操作履歴" subtitle={`${total} 件`} />
      <div className="px-6 pb-3">
        <AuditLogFilterBar
          filter={filter}
          setFilter={setFilter}
          users={users}
        />
      </div>

      {/* ここだけが伸び縮みする。`min-h-0` が無いと flex の子は縮まず、
          はみ出した分がページごとスクロールしてフッターが流れていく。
          上下の余白は置かない —— 「自動」はこの箱の高さ（`clientHeight`）を
          1行の高さで割るので、余白を入れるとその分だけ多く数えてしまう */}
      <div ref={viewportRef} className="min-h-0 flex-1 overflow-auto px-6">
        {error && (
          <div className="mt-4 mb-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <History />
              </EmptyMedia>
              <EmptyTitle>記録された操作はありません</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <div>
            {logs.map((log) => (
              <AuditLogItem
                key={log.id}
                log={log}
                actorName={
                  log.userId ? (userById.get(log.userId)?.name ?? null) : null
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* 初回の取得中は総件数が 0 なので出ない。ページを送っている間は
          前のページを出したままなので、フッターは動かない */}
      {total > 0 && (
        <ListPaginationFooter
          total={total}
          firstRowNumber={firstRowNumber}
          lastRowNumber={lastRowNumber}
          pageSize={pageSize}
          pageSizeChoice={pageSizeChoice}
          onPageSizeChoiceChange={setPageSizeChoice}
          pageNumber={pageNumber}
          pageCount={pageCount}
          onPageChange={setPageNumber}
        />
      )}
    </div>
  )
}
