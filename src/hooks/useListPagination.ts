"use client"

import type { RefObject } from "react"
import { useState } from "react"

import { usePageWindow } from "@/hooks/usePageWindow"
import type { PageSizeChoice } from "@/lib/listPagination"

interface UseListPaginationOptions {
  /**
   * 1行の高さの見積もり（px）。「自動」はこれで割る。
   *
   * 実測より少し大きめに取り、はみ出すより余らせる（足りない分はスクロールできるが、
   * 余白は操作できない）。
   */
  rowHeight: number
  /** 行の上に居座るもの（見出し行など）の高さ（px） */
  reservedHeight: number
  /**
   * 変わったら先頭のページへ戻す値。絞り込みと並び順を繋いだものを渡す。
   *
   * 3ページ目のまま絞り込むと、一致が1ページ分しかないときに空の画面へ着地する。
   */
  resetKey: string
}

interface UseListPaginationResult<Row> {
  /** いま見ているページの行だけ */
  pageRows: Row[]
  /** 1始まり。件数が変われば「いま見ている行」から計算し直される */
  pageNumber: number
  /** 実際に並べている件数（「自動」なら高さから決まった値） */
  pageSize: number
  pageSizeChoice: PageSizeChoice
  setPageSizeChoice: (choice: PageSizeChoice) => void
  /** 総ページ数（0件でも1ページと数える） */
  pageCount: number
  setPageNumber: (pageNumber: number) => void
  /** いま見ている先頭の行番号（1始まり。0件なら 0） */
  firstRowNumber: number
  /** いま見ている末尾の行番号 */
  lastRowNumber: number
  /** 「自動」が高さを測る相手。行が縦に伸びる箱へ付ける */
  viewportRef: RefObject<HTMLDivElement | null>
}

/**
 * 手元にある行をページへ切り分ける。
 *
 * 監査ログ（`useAuditLogs`）と違い、行は既に全部揃っている（main は一覧を丸ごと
 * 返す）。ここでやるのは切り出しだけで、取得は起こらない。
 *
 * ページの窓（先頭の行と件数）は監査ログと共通の `usePageWindow` が持つ。
 */
export function useListPagination<Row>(
  rows: Row[],
  { rowHeight, reservedHeight, resetKey }: UseListPaginationOptions
): UseListPaginationResult<Row> {
  const {
    firstRowIndex,
    setFirstRowIndex,
    pageNumber,
    pageSize,
    pageSizeChoice,
    setPageSizeChoice,
    setPageNumber,
    viewportRef,
  } = usePageWindow({ rowHeight, reservedHeight })

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))

  // 絞り込みと並び順を変えたら先頭のページから見る
  const [seededResetKey, setSeededResetKey] = useState(resetKey)
  if (seededResetKey !== resetKey) {
    setSeededResetKey(resetKey)
    setFirstRowIndex(0)
  }

  // 行が減って、いま見ている先頭が最後のページより後ろになったら詰め直す。
  // `resetKey` を変えずに行が減る経路（別の端末の書き込みが同期で届く、削除した）
  // があるので、鍵の付け替えだけでは足りない
  const lastPageFirstRowIndex = (pageCount - 1) * pageSize
  if (firstRowIndex > lastPageFirstRowIndex) {
    setFirstRowIndex(lastPageFirstRowIndex)
  }

  return {
    pageRows: rows.slice(firstRowIndex, firstRowIndex + pageSize),
    pageNumber,
    pageSize,
    pageSizeChoice,
    setPageSizeChoice,
    pageCount,
    setPageNumber,
    firstRowNumber: rows.length === 0 ? 0 : firstRowIndex + 1,
    lastRowNumber: Math.min(rows.length, firstRowIndex + pageSize),
    viewportRef,
  }
}
