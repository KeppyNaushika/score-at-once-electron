"use client"

import { QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

import { createAppQueryClient } from "@/queries/queryClient"

/**
 * TanStack Query の土台。
 *
 * 設定の中身は `src/queries/queryClient.ts` にある（テストから同じものを作れるよう、
 * コンポーネントの外へ出してある）。
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // クライアントごとに1つ持つ。モジュール直下で作ると、SSR時に全リクエストで共有される
  const [queryClient] = useState(createAppQueryClient)

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}
