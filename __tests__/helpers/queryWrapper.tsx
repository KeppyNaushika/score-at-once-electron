/**
 * `useQuery` / `useMutation` を使うフック・コンポーネントを renderHook / render に
 * 載せるためのラッパー。取得は TanStack Query が担うので、テストからも Provider が要る。
 *
 * **アプリと同じ QueryClient を使う**（`createAppQueryClient`）。書き込みの後始末
 * （`meta.invalidates` による取り直し）は `MutationCache` が持っているので、素の
 * `QueryClient` で包むと「書いたのに取り直さない」状態でテストすることになり、
 * 本番と食い違う。
 *
 * キャッシュはテストごとに新しい QueryClient を作って持ち越さない。
 */
import { QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

import { createAppQueryClient } from "@/queries/queryClient"

/** renderHook / render の `wrapper` に渡す */
export function createQueryWrapper() {
  const queryClient = createAppQueryClient()
  // 取得済みを持ち越さない。テスト間で前の結果が見えると順序に依存する
  queryClient.setDefaultOptions({
    queries: {
      ...queryClient.getDefaultOptions().queries,
      gcTime: 0,
      staleTime: 0,
    },
  })

  return function QueryWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}
