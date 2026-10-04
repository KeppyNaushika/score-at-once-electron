import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import type { AuditLogFilter } from "@/electron-src/lib/prisma/auditQuery"

/**
 * 監査ログの取得。
 *
 * 対応する preload は `electron-src/preload-apis/auditLogApi.ts`。
 */

/** 一覧の何ページ目を何件で見ているか（ページ番号は1始まり） */
interface AuditLogPagination {
  pageNumber: number
  pageSize: number
}

/**
 * 監査ログ全体の行き先。
 *
 * 絞り込みごとにキーが分かれるので、**取り直しは前方一致で全部**を指す。監査ログを
 * 1行足す書き込み（書き出し・取り込みなど）はここを指す。
 */
export const auditLogListKey = ["auditLog", "list"] as const

/**
 * 監査ログの一覧（1ページ分）。
 *
 * 絞り込み条件とページは要求そのものなのでキーに入る（同定用の id ではない）。
 * 条件を変えると別のキーになり、先頭から取り直しになる。
 *
 * 行は保持日数のぶん積み上がるので（`docs/audit-log-redesign.md` の見積もりで
 * 年12万行）、**切るのは main**（`take` / `skip` / `count`）で、renderer へ渡るのは
 * 1ページ分と総件数だけである。ここは「計算は renderer 側」規約に対して
 * `auditQuery.ts` の2関数だけに認められた例外にあたる。
 *
 * ページを送っている間は直前のページを出したままにする（`keepPreviousData`）。
 * 空の一覧を挟むと高さが変わって画面が跳ねる。
 */
export const auditLogListQuery = (
  filter: AuditLogFilter,
  pagination: AuditLogPagination
) =>
  queryOptions({
    queryKey: [...auditLogListKey, filter, pagination] as const,
    queryFn: () =>
      window.electronAPI.audit.getLogs(
        filter,
        pagination.pageSize,
        (pagination.pageNumber - 1) * pagination.pageSize
      ),
    placeholderData: keepPreviousData,
  })

/**
 * 絞り込みの選択肢（ログに現れた作業領域と対象）。
 *
 * 出どころはログ自身なので、削除済みの試験・生徒・採点領域も候補に出る。
 * 引数なしで全件（作業領域は数十、対象は生徒×作業領域で数千行の規模）。
 */
export const auditLogScopesQuery = () =>
  queryOptions({
    queryKey: ["auditLog", "scopes"] as const,
    queryFn: () => window.electronAPI.audit.getScopes(),
  })
