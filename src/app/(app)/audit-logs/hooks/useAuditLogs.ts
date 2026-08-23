"use client"

import { useQuery } from "@tanstack/react-query"
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useState,
} from "react"

import type { AuditLogFilter } from "@/electron-src/lib/prisma/auditQuery"
import { auditLogListQuery } from "@/queries/auditLog"
import type { AuditLogEntry } from "@/types/auditLog.types"

import { DEFAULT_AUDIT_LOG_PAGE_SIZE } from "../constants"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_ENTRIES: AuditLogEntry[] = []

interface UseAuditLogsResult {
  /** 今見ているページの行だけ（一覧全体は renderer へ運ばない） */
  entries: AuditLogEntry[]
  /** 絞り込みに一致する総件数（main が同じ where で数えたもの） */
  total: number
  loading: boolean
  /** ページを送っている最中（前のページを出したまま次を待つ） */
  fetching: boolean
  error: string | null
  filter: AuditLogFilter
  /** 直前のフィルタを受け取る更新関数も渡せる（デバウンス中の取りこぼしを防ぐため） */
  setFilter: Dispatch<SetStateAction<AuditLogFilter>>
  /** 1始まり */
  pageNumber: number
  pageSize: number
  /** 総ページ数（0件でも1ページと数える） */
  pageCount: number
  setPageNumber: (pageNumber: number) => void
  setPageSize: (pageSize: number) => void
}

/**
 * 監査ログの取得フック。
 *
 * ページは画面の状態として持つ（URL には載せない）。載せると未保存の確認
 * （`NavigationGuardContext`）を通る遷移になり、ページを送るたびに離脱確認が
 * 割り込みうる。
 */
export function useAuditLogs(): UseAuditLogsResult {
  const [filter, setFilterState] = useState<AuditLogFilter>({})
  const [pageNumber, setPageNumber] = useState(1)
  const [pageSize, setPageSizeState] = useState(DEFAULT_AUDIT_LOG_PAGE_SIZE)

  // 絞り込みとページはクエリキーの一部。どちらを変えても別のキーになる
  const {
    data,
    isPending: loading,
    isFetching: fetching,
    error,
  } = useQuery(auditLogListQuery(filter, { pageNumber, pageSize }))

  // 条件を変えたら先頭のページから見る。3ページ目のまま絞り込むと、
  // 一致が1ページ分しかないときに空の画面へ着地する
  const setFilter = useCallback<Dispatch<SetStateAction<AuditLogFilter>>>(
    (update) => {
      setFilterState(update)
      setPageNumber(1)
    },
    []
  )

  const setPageSize = useCallback((nextPageSize: number) => {
    setPageSizeState(nextPageSize)
    setPageNumber(1)
  }, [])

  const total = data?.total ?? 0

  return {
    entries: data?.entries ?? EMPTY_ENTRIES,
    total,
    loading,
    fetching,
    error: error?.message ?? null,
    filter,
    setFilter,
    pageNumber,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    setPageNumber,
    setPageSize,
  }
}
