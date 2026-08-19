import { infiniteQueryOptions } from "@tanstack/react-query"

import type { AuditLogFilter } from "@/electron-src/lib/prisma/auditQuery"

/**
 * 監査ログの取得。
 *
 * 対応する preload は `electron-src/preload-apis/auditLogApi.ts`。
 */

const PAGE_SIZE = 50

/**
 * 監査ログ全体の行き先。
 *
 * 絞り込みごとにキーが分かれるので、**取り直しは前方一致で全部**を指す。監査ログを
 * 1行足す書き込み（書き出し・取り込みなど）はここを指す。
 */
export const auditLogListKey = ["auditLog", "list"] as const

/**
 * 監査ログの一覧（無限スクロール）。
 *
 * 絞り込み条件は要求そのものなのでキーに入る（同定用の id ではない）。条件を
 * 変えると先頭から取り直しになる。
 */
export const auditLogListQuery = (filter: AuditLogFilter) =>
  infiniteQueryOptions({
    queryKey: ["auditLog", "list", filter] as const,
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
