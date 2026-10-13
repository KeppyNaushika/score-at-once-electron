"use client"

import type { Dispatch, RefObject, SetStateAction } from "react"
import { useCallback, useEffect, useRef, useState } from "react"

import {
  AUTO_PAGE_SIZE,
  FALLBACK_PAGE_SIZE,
  type PageSizeChoice,
} from "@/lib/listPagination"

interface UsePageWindowOptions {
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
   * 総件数。**まだ分からないとき（読み込み中）は `undefined`** を渡す。
   *
   * 分からない間は詰め直さない。0件と取り違えると、取得を待つたびに先頭へ戻される。
   */
  totalRows: number | undefined
}

interface UsePageWindowResult {
  /** いま見ている先頭の行（0始まり） */
  firstRowIndex: number
  /** 先頭の行を直に動かす。絞り込みを変えたときの巻き戻しや詰め直しに使う */
  setFirstRowIndex: Dispatch<SetStateAction<number>>
  /** 1始まり。件数が変われば「いま見ている行」から計算し直される */
  pageNumber: number
  /** 実際に並べる件数（「自動」なら高さから決まった値） */
  pageSize: number
  pageSizeChoice: PageSizeChoice
  setPageSizeChoice: (choice: PageSizeChoice) => void
  setPageNumber: (pageNumber: number) => void
  /** 「自動」が高さを測る相手。行が縦に伸びる箱へ付ける */
  viewportRef: RefObject<HTMLDivElement | null>
}

/**
 * 一覧の「いま見ている窓」（先頭の行と1ページの件数）を持つ。
 *
 * 行を手元で切り出す一覧（`useListPagination`）と、main にページを要求する監査ログ
 * （`useAuditLogs`）が共に使う。件数が減ったときの詰め直しはここが持ち、総件数と
 * 絞り込みでの巻き戻しは、件数の出どころが違うので使う側が持つ。
 *
 * **覚えているのはページ番号ではなく先頭の行**（0始まり）。「自動」は表示領域の高さ
 * から件数を決めるので、**窓を広げれば1ページの件数が増えて総ページ数が減る**。
 * ページ番号を覚えていると、10ページ目を見ている最中に総数が6ページへ縮んで
 * **空の一覧に着地する**（ページャは6までしか出さないので、いま居るページの
 * ボタンさえ無い）。先頭の行を覚えていれば、件数が変わっても「いま見ている行」は
 * 動かず、ページ番号の方が計算し直される。
 */
export function usePageWindow({
  rowHeight,
  reservedHeight,
  totalRows,
}: UsePageWindowOptions): UsePageWindowResult {
  const [firstRowIndex, setFirstRowIndex] = useState(0)
  const [pageSizeChoice, setPageSizeChoiceState] =
    useState<PageSizeChoice>(AUTO_PAGE_SIZE)

  // 「自動」のときだけ使う。高さは表示領域そのものから測る（見積もりで決め打つと、
  // サイドバーを畳んだ・窓を変えたときに合わなくなる）
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

  const measuredPageSize = Math.floor(
    (viewportHeight - reservedHeight) / rowHeight
  )
  const pageSize =
    pageSizeChoice === AUTO_PAGE_SIZE
      ? measuredPageSize > 0
        ? measuredPageSize
        : FALLBACK_PAGE_SIZE
      : pageSizeChoice

  // 件数が減って、いま見ている先頭が最後のページより後ろになったら詰め直す。
  // 絞り込みを変えずに件数が減る経路（別の端末の書き込みが同期で届く、削除した、
  // 監査ログの保持期間が過ぎた）があるので、絞り込みでの巻き戻しだけでは足りない
  if (totalRows !== undefined) {
    const pageCount = Math.max(1, Math.ceil(totalRows / pageSize))
    const lastPageFirstRowIndex = (pageCount - 1) * pageSize
    if (firstRowIndex > lastPageFirstRowIndex) {
      setFirstRowIndex(lastPageFirstRowIndex)
    }
  }

  // 件数を選び直すのは利用者の操作なので、先頭から見直す（窓の大きさが変わった
  // ときと違い、いま見ている行に留まる理由がない）
  const setPageSizeChoice = useCallback((choice: PageSizeChoice) => {
    setPageSizeChoiceState(choice)
    setFirstRowIndex(0)
  }, [])

  const setPageNumber = useCallback(
    (nextPageNumber: number) => {
      setFirstRowIndex((nextPageNumber - 1) * pageSize)
    },
    [pageSize]
  )

  return {
    firstRowIndex,
    setFirstRowIndex,
    pageNumber: Math.floor(firstRowIndex / pageSize) + 1,
    pageSize,
    pageSizeChoice,
    setPageSizeChoice,
    setPageNumber,
    viewportRef,
  }
}
