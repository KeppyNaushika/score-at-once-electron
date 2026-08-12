"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { queryKeys } from "@/lib/queryKeys"

/**
 * 学級の全件（所属生徒付き）。
 *
 * 学級は生徒管理・試験の受験生徒・成績のどこからでも増減するので、
 * 画面ごとに取り直さず1つのキャッシュを共有する。
 */
export function useClassrooms() {
  const queryClient = useQueryClient()
  const { data: classrooms = [], isPending } = useQuery({
    queryKey: queryKeys.classrooms.all,
    queryFn: () => window.electronAPI.fetchClassrooms(),
  })

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.classrooms.all }),
    [queryClient]
  )

  return { classrooms, isPending, refresh }
}
