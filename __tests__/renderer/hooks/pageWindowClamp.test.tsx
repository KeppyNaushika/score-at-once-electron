// @vitest-environment jsdom
/**
 * 件数が減ったときのページの詰め直し（`usePageWindow`）。
 *
 * 一覧（`useListPagination`）と監査ログ（`useAuditLogs`）は同じページの窓を使う。
 * 固定するのは3つ。
 *
 * 1. **監査ログも詰め直す。** 3ページ目を見ている間に main の数えた件数が減ると、
 *    最後のページへ詰め直して範囲内を取り直す。範囲外の要求を繰り返さない
 * 2. **読み込み中は先頭へ戻らない。** 件数が分からない間を0件と取り違えない
 * 3. **一覧の詰め直しは従来どおり。** 行が減ったら最後のページへ
 *
 * jsdom には `ResizeObserver` が無いが、高さを測る箱を付けなければ測りに行かず、
 * 1ページの件数は既定（`FALLBACK_PAGE_SIZE` = 10）になる。
 */

import "../setup"

import { QueryClientProvider } from "@tanstack/react-query"
import { act, renderHook, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { describe, expect, it, vi } from "vitest"

import { useAuditLogs } from "@/app/(app)/audit-logs/hooks/useAuditLogs"
import { useListPagination } from "@/hooks/useListPagination"
import { auditLogListKey } from "@/queries/auditLog"
import { createAppQueryClient } from "@/queries/queryClient"

/** main が数える総件数。テストの途中で減らす */
interface AuditLogStore {
  total: number
}

/**
 * `audit:getLogs` を差し替える。行そのものは見ないので空で返し、件数だけを
 * `store` から読む。`gate` を渡すと、それが解けるまで返さない（読み込み中を作る）
 */
function installAuditLogs(store: AuditLogStore, gate?: Promise<void>) {
  const getLogs = vi.fn(async (_filter: unknown, limit: number, offset: number) => {
    if (gate) await gate
    return { logs: [], total: store.total, limit, offset }
  })
  Object.defineProperty(window, "electronAPI", {
    value: { audit: { getLogs } },
    writable: true,
    configurable: true,
  })
  return getLogs
}

/** 取り直しを外から起こすので、QueryClient を手元に持つ */
function createWrapperWithClient() {
  const queryClient = createAppQueryClient()
  queryClient.setDefaultOptions({
    queries: {
      ...queryClient.getDefaultOptions().queries,
      gcTime: 0,
      staleTime: 0,
    },
  })
  function QueryWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
  return { queryClient, wrapper: QueryWrapper }
}

describe("監査ログのページ送り", () => {
  it("3ページ目を見ている間に件数が減ると、最後のページへ詰め直す", async () => {
    const store: AuditLogStore = { total: 50 }
    const getLogs = installAuditLogs(store)
    const { queryClient, wrapper } = createWrapperWithClient()
    const { result } = renderHook(() => useAuditLogs({ tokens: [] }), {
      wrapper,
    })
    await waitFor(() => expect(result.current.total).toBe(50))

    act(() => result.current.setPageNumber(3))
    await waitFor(() =>
      expect(getLogs).toHaveBeenLastCalledWith(expect.anything(), 10, 20)
    )
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.pageNumber).toBe(3)

    // 同期で削除が届き、2ページ分に減った
    store.total = 15
    await act(() =>
      queryClient.invalidateQueries({ queryKey: auditLogListKey })
    )

    await waitFor(() => expect(result.current.pageNumber).toBe(2))
    await waitFor(() =>
      expect(getLogs).toHaveBeenLastCalledWith(expect.anything(), 10, 10)
    )
    expect(result.current.pageCount).toBe(2)
    expect(result.current.total).toBe(15)

    // 範囲外（3ページ目）の要求は、最初の取得と取り直しの2回だけで繰り返さない
    const outOfRangeRequests = getLogs.mock.calls.filter(
      ([, , offset]) => offset === 20
    )
    expect(outOfRangeRequests).toHaveLength(2)
    const settledCallCount = getLogs.mock.calls.length
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(getLogs).toHaveBeenCalledTimes(settledCallCount)
    expect(result.current.pageNumber).toBe(2)
  })

  it("件数を数え終えるまでは先頭へ戻らない", async () => {
    const store: AuditLogStore = { total: 50 }
    let openGate = () => {}
    const gate = new Promise<void>((resolve) => {
      openGate = resolve
    })
    installAuditLogs(store, gate)
    const { wrapper } = createWrapperWithClient()
    const { result } = renderHook(() => useAuditLogs({ tokens: [] }), {
      wrapper,
    })

    act(() => result.current.setPageNumber(3))
    expect(result.current.loading).toBe(true)
    expect(result.current.pageNumber).toBe(3)

    act(() => openGate())
    await waitFor(() => expect(result.current.total).toBe(50))
    expect(result.current.pageNumber).toBe(3)
  })
})

describe("一覧のページ送り", () => {
  const createRows = (count: number) =>
    Array.from({ length: count }, (_, rowIndex) => `行${rowIndex + 1}`)

  it("行が減ったら最後のページへ詰め直す", () => {
    const { result, rerender } = renderHook(
      ({ rows }: { rows: string[] }) =>
        useListPagination(rows, {
          rowHeight: 40,
          reservedHeight: 0,
          resetKey: "",
        }),
      { initialProps: { rows: createRows(50) } }
    )

    act(() => result.current.setPageNumber(3))
    expect(result.current.pageNumber).toBe(3)
    expect(result.current.pageRows[0]).toBe("行21")

    rerender({ rows: createRows(15) })
    expect(result.current.pageNumber).toBe(2)
    expect(result.current.pageCount).toBe(2)
    expect(result.current.pageRows).toEqual(createRows(15).slice(10))

    // 0件になれば1ページ目（空）
    rerender({ rows: [] })
    expect(result.current.pageNumber).toBe(1)
    expect(result.current.firstRowNumber).toBe(0)
  })

  it("行が減っても、いま見ている先頭が範囲内なら動かない", () => {
    const { result, rerender } = renderHook(
      ({ rows }: { rows: string[] }) =>
        useListPagination(rows, {
          rowHeight: 40,
          reservedHeight: 0,
          resetKey: "",
        }),
      { initialProps: { rows: createRows(50) } }
    )

    act(() => result.current.setPageNumber(3))
    rerender({ rows: createRows(25) })
    expect(result.current.pageNumber).toBe(3)
    expect(result.current.pageRows).toEqual(createRows(25).slice(20))
  })
})
