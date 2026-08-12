/**
 * `useQuery` を使うフック・コンポーネントを renderHook / render に載せるための
 * ラッパー。取得は TanStack Query が担うので、テストからも Provider が要る。
 *
 * リトライは切る（失敗の検証で3回待たされないため）。キャッシュもテストごとに
 * 新しい QueryClient を作って持ち越さない。
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

/** renderHook / render の `wrapper` に渡す */
export function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  })

  return function QueryWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}
