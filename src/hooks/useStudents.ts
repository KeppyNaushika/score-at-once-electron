"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { queryKeys } from "@/lib/queryKeys"

/**
 * 生徒の全件（所属付き）。
 *
 * 生徒は学級・試験・資料のどこからでも増減するので、画面ごとに取り直さず
 * 1つのキャッシュを共有する。追加・更新した画面が `refresh` を呼べば、
 * 開いている他の画面の一覧も揃う。
 */
export function useStudents() {
  const queryClient = useQueryClient()
  const { data: students = [], isPending } = useQuery({
    queryKey: queryKeys.students.all,
    queryFn: () => window.electronAPI.fetchStudents(),
  })

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.students.all }),
    [queryClient]
  )

  return { students, isPending, refresh }
}
