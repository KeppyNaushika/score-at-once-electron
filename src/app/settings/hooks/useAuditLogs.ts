"use client"

import { useCallback, useEffect, useState } from "react"

import type { AuditLogFilter } from "@/electron-src/lib/prisma/auditQuery"
import type { AuditLogEntry } from "@/types/electron/auditLogApi"

const PAGE_SIZE = 50

interface UseAuditLogsResult {
  entries: AuditLogEntry[]
  total: number
  loading: boolean
  loadingMore: boolean
  error: string | null
  filter: AuditLogFilter
  setFilter: (filter: AuditLogFilter) => void
  hasMore: boolean
  loadMore: () => void
  reload: () => void
}

/**
 * 監査ログの取得フック。フィルタ変更で先頭から再取得し、
 * loadMore でオフセットを進めて追記する。
 */
export function useAuditLogs(): UseAuditLogsResult {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilterState] = useState<AuditLogFilter>({})

  const fetchPage = useCallback(
    (offset: number, currentFilter: AuditLogFilter) =>
      window.electronAPI.audit.getLogs({
        ...currentFilter,
        limit: PAGE_SIZE,
        offset,
      }),
    []
  )

  const reload = useCallback(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const page = await fetchPage(0, filter)
        if (cancelled) return
        setEntries(page.entries)
        setTotal(page.total)
      } catch (e) {
        if (cancelled) return
        setError(
          e instanceof Error ? e.message : "監査ログの取得に失敗しました"
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [fetchPage, filter])

  useEffect(() => {
    const cleanup = reload()
    return cleanup
  }, [reload])

  const loadMore = useCallback(() => {
    setLoadingMore(true)
    void (async () => {
      try {
        const page = await fetchPage(entries.length, filter)
        setEntries((prev) => [...prev, ...page.entries])
        setTotal(page.total)
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "監査ログの取得に失敗しました"
        )
      } finally {
        setLoadingMore(false)
      }
    })()
  }, [entries.length, fetchPage, filter])

  const setFilter = useCallback((next: AuditLogFilter) => {
    setFilterState(next)
  }, [])

  return {
    entries,
    total,
    loading,
    loadingMore,
    error,
    filter,
    setFilter,
    hasMore: entries.length < total,
    loadMore,
    reload,
  }
}
