"use client"

import { useQuery } from "@tanstack/react-query"
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react"

import { usePageWindow } from "@/hooks/usePageWindow"
import type { AuditFilterState } from "@/lib/auditLogFilterQuery"
import type { PageSizeChoice } from "@/lib/listPagination"
import { auditLogListQuery } from "@/queries/auditLog"
import type { AuditLogRow } from "@/types/auditLog.types"

import { AUDIT_LOG_ROW_HEIGHT } from "../constants"
import { toAuditLogFilter } from "../filterFields"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_LOGS: AuditLogRow[] = []

interface UseAuditLogsResult {
  /** 今見ているページの行だけ（一覧全体は renderer へ運ばない） */
  logs: AuditLogRow[]
  /** 絞り込みに一致する総件数（main が同じ where で数えたもの） */
  total: number
  loading: boolean
  error: string | null
  /** 絞り込みの画面の状態（確定した欄と全文検索） */
  filter: AuditFilterState
  /** 直前のフィルタを受け取る更新関数も渡せる（デバウンス中の取りこぼしを防ぐため） */
  setFilter: Dispatch<SetStateAction<AuditFilterState>>
  /** 1始まり。件数が変われば「いま見ている行」から計算し直される */
  pageNumber: number
  /** 実際に要求している件数（「自動」なら高さから決まった値） */
  pageSize: number
  pageSizeChoice: PageSizeChoice
  /** 総ページ数（0件でも1ページと数える） */
  pageCount: number
  setPageNumber: (pageNumber: number) => void
  setPageSizeChoice: (choice: PageSizeChoice) => void
  /** 「自動」が高さを測る相手。ログが縦に伸びる箱へ付ける */
  viewportRef: RefObject<HTMLDivElement | null>
}

/**
 * 監査ログの取得フック。
 *
 * ページと絞り込みは画面の状態として持つ（URL には載せない）。載せると未保存の確認
 * （`NavigationGuardContext`）を通る遷移になり、ページを送るたびに離脱確認が
 * 割り込みうる。URL から読むのは最初の絞り込み（詳細ページからのリンク）だけ。
 */
export function useAuditLogs(
  initialFilter: AuditFilterState
): UseAuditLogsResult {
  const [filter, setFilterState] = useState<AuditFilterState>(initialFilter)
  /**
   * ページの窓（先頭の行と件数）は一覧と共通。見出し行は数えない（`reservedHeight: 0`）。
   *
   * `firstRowIndex < total` である限り `1 ≤ ページ番号 ≤ 総ページ数` は自動的に
   * 満たされるので、詰め直す処理も要らない。
   */
  const {
    setFirstRowIndex,
    pageNumber,
    pageSize,
    pageSizeChoice,
    setPageSizeChoice,
    setPageNumber,
    viewportRef,
  } = usePageWindow({ rowHeight: AUDIT_LOG_ROW_HEIGHT, reservedHeight: 0 })

  // 画面の状態（欄の並び）を main へ渡す条件にする。欄の文言（label）は条件に
  // 入らないので、同じ条件なら同じクエリキーになる
  const queryFilter = useMemo(() => toAuditLogFilter(filter), [filter])

  // 絞り込みとページはクエリキーの一部。どちらを変えても別のキーになる
  const {
    data,
    isPending: loading,
    error,
  } = useQuery(auditLogListQuery(queryFilter, { pageNumber, pageSize }))

  // 条件を変えたら先頭のページから見る。3ページ目のまま絞り込むと、
  // 一致が1ページ分しかないときに空の画面へ着地する
  const setFilter = useCallback<Dispatch<SetStateAction<AuditFilterState>>>(
    (update) => {
      setFilterState(update)
      setFirstRowIndex(0)
    },
    [setFirstRowIndex]
  )

  const total = data?.total ?? 0

  return {
    logs: data?.logs ?? EMPTY_LOGS,
    total,
    loading,
    error: error?.message ?? null,
    filter,
    setFilter,
    pageNumber,
    pageSize,
    pageSizeChoice,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    setPageNumber,
    setPageSizeChoice,
    viewportRef,
  }
}
