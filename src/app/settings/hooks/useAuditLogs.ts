"use client"

import { useInfiniteQuery } from "@tanstack/react-query"
import { type Dispatch, type SetStateAction, useMemo, useState } from "react"

import type { AuditLogFilter } from "@/electron-src/lib/prisma/auditQuery"
import { queryKeys } from "@/lib/queryKeys"
import type { AuditLogEntry } from "@/types/auditLog.types"

const PAGE_SIZE = 50

interface UseAuditLogsResult {
  entries: AuditLogEntry[]
  total: number
  loading: boolean
  loadingMore: boolean
  error: string | null
  filter: AuditLogFilter
  /** 直前のフィルタを受け取る更新関数も渡せる（デバウンス中の取りこぼしを防ぐため） */
  setFilter: Dispatch<SetStateAction<AuditLogFilter>>
  hasMore: boolean
  loadMore: () => void
}

/**
 * 監査ログの取得フック。フィルタ変更で先頭から再取得し、
 * loadMore でオフセットを進めて追記する。
 */
export function useAuditLogs(): UseAuditLogsResult {
  const [filter, setFilterState] = useState<AuditLogFilter>({})

  // 絞り込みはクエリキーの一部。条件を変えると先頭から取り直しになる。
  // 追記していくページは useInfiniteQuery が持つので、こちらで連結しない
  // （遅れて返った古いページが後ろに継ぎ足される取りこぼしが起きない）。
  const {
    data,
    isPending: loading,
    isFetchingNextPage: loadingMore,
    error,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.auditLog.list(filter),
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      window.electronAPI.audit.getLogs({
        ...filter,
        limit: PAGE_SIZE,
        offset: pageParam,
      }),
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce(
        (count, page) => count + page.entries.length,
        0
      )
      return loaded < lastPage.total ? loaded : undefined
    },
  })

  const entries = useMemo<AuditLogEntry[]>(
    () => (data?.pages ?? []).flatMap((page) => page.entries),
    [data]
  )
  const total = data?.pages.at(-1)?.total ?? 0

  return {
    entries,
    total,
    loading,
    loadingMore,
    error: error?.message ?? null,
    filter,
    setFilter: setFilterState,
    hasMore: hasNextPage,
    loadMore: () => void fetchNextPage(),
  }
}
