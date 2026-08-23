"use client"

import { useQuery } from "@tanstack/react-query"
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"

import type { AuditLogFilter } from "@/electron-src/lib/prisma/auditQuery"
import { auditLogListQuery } from "@/queries/auditLog"
import type { AuditLogEntry } from "@/types/auditLog.types"

import {
  AUDIT_LOG_ROW_HEIGHT,
  AUTO_PAGE_SIZE,
  FALLBACK_AUDIT_LOG_PAGE_SIZE,
} from "../constants"

/** 1ページの件数の指定。「自動」は表示領域の高さから決める */
export type AuditLogPageSizeChoice = typeof AUTO_PAGE_SIZE | number

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
  /** 1始まり。件数が変われば「いま見ている行」から計算し直される */
  pageNumber: number
  /** 実際に要求している件数（「自動」なら高さから決まった値） */
  pageSize: number
  pageSizeChoice: AuditLogPageSizeChoice
  /** 総ページ数（0件でも1ページと数える） */
  pageCount: number
  setPageNumber: (pageNumber: number) => void
  setPageSizeChoice: (choice: AuditLogPageSizeChoice) => void
  /** 「自動」が高さを測る相手。ログが縦に伸びる箱へ付ける */
  viewportRef: RefObject<HTMLDivElement | null>
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
  /**
   * 覚えているのは**ページ番号ではなく先頭の行**（0始まり）。
   *
   * 「自動」は表示領域の高さから件数を決めるので、**窓を広げれば1ページの件数が
   * 増えて総ページ数が減る**。ページ番号を覚えていると、10ページ目を見ている最中に
   * 総数が6ページへ縮んで**空の一覧に着地する**（ページャは6までしか出さないので、
   * いま居るページのボタンさえ無い）。先頭の行を覚えていれば、件数が変わっても
   * 「いま見ている行」は動かず、ページ番号の方が計算し直される。
   *
   * `firstRowIndex < total` である限り `1 ≤ ページ番号 ≤ 総ページ数` は自動的に
   * 満たされるので、詰め直す処理も要らない。
   */
  const [firstRowIndex, setFirstRowIndex] = useState(0)
  const [pageSizeChoice, setPageSizeChoiceState] =
    useState<AuditLogPageSizeChoice>(AUTO_PAGE_SIZE)

  // 「自動」のときだけ使う。高さは表示領域そのものから測る（見積もりで
  // 決め打つと、サイドバーを畳んだ・窓を変えたときに合わなくなる）
  const viewportRef = useRef<HTMLDivElement>(null)
  const [viewportHeight, setViewportHeight] = useState(0)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    // observe した時点で1度呼ばれるので、初回の高さもここで入る
    const observer = new ResizeObserver(() =>
      setViewportHeight(viewport.clientHeight)
    )
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  const measuredPageSize = Math.floor(viewportHeight / AUDIT_LOG_ROW_HEIGHT)
  const pageSize =
    pageSizeChoice === AUTO_PAGE_SIZE
      ? measuredPageSize > 0
        ? measuredPageSize
        : FALLBACK_AUDIT_LOG_PAGE_SIZE
      : pageSizeChoice

  const pageNumber = Math.floor(firstRowIndex / pageSize) + 1

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
      setFirstRowIndex(0)
    },
    []
  )

  // 件数を選び直すのは利用者の操作なので、先頭から見直す（窓の大きさが変わった
  // ときと違い、いま見ている行に留まる理由がない）
  const setPageSizeChoice = useCallback((choice: AuditLogPageSizeChoice) => {
    setPageSizeChoiceState(choice)
    setFirstRowIndex(0)
  }, [])

  const setPageNumber = useCallback(
    (nextPageNumber: number) => {
      setFirstRowIndex((nextPageNumber - 1) * pageSize)
    },
    [pageSize]
  )

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
    pageSizeChoice,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    setPageNumber,
    setPageSizeChoice,
    viewportRef,
  }
}
