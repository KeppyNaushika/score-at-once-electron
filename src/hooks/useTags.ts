"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { queryKeys } from "@/lib/queryKeys"

/**
 * タグ一覧（タグフィルタの選択肢・タグ入力の候補）。
 *
 * タグは試験・資料・解答用紙定義・小計点グループのどこからでも増えるので、
 * 画面ごとに取り直さず1つのキャッシュを共有する。追加した画面が `refresh` を
 * 呼べば、開いている他の画面の候補も揃う。
 */
export function useTags() {
  const queryClient = useQueryClient()
  const { data: tags = [], isPending } = useQuery({
    queryKey: queryKeys.tags.all,
    queryFn: () => window.electronAPI.tagGetAll(),
  })

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.tags.all }),
    [queryClient]
  )

  return { tags, isPending, refresh }
}
