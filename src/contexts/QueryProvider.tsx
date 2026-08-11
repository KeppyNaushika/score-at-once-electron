"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

/**
 * TanStack Query の土台。
 *
 * データは全て preload 経由の IPC（`window.electronAPI`）で取る。ネットワークを跨がないので
 * 再試行しても結果は変わらず、失敗はそのまま呼び出し側へ返す。
 *
 * 窓に戻るたびの再取得は既定で止める。NAS同期で他の教員の変更が入ることはあるが、
 * 採点中に手元の表示が動くほうが害が大きい。拾いたい画面では、その画面の useQuery で
 * refetchOnWindowFocus を有効にする。
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // クライアントごとに1つ持つ。モジュール直下で作ると、SSR時に全リクエストで共有される
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
