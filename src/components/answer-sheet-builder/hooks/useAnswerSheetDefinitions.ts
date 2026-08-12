"use client"

import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { toast } from "sonner"

import { queryKeys } from "@/lib/queryKeys"

/**
 * 解答用紙定義一覧のCRUDフック。
 * IPC経由でメインプロセスの定義リストを取得・操作する。
 */
export function useAnswerSheetDefinitions(userId: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = queryKeys.answerSheetDefinition.list(userId)
  const { data: definitions = [], isPending: isLoading } = useQuery({
    queryKey,
    queryFn: userId
      ? () => window.electronAPI.answerSheetBuilder.listDefinitions(userId)
      : skipToken,
  })

  const loadDefinitions = useCallback(
    () => queryClient.invalidateQueries({ queryKey }),
    [queryClient, queryKey]
  )

  const deleteDefinition = useCallback(
    async (id: string) => {
      const api = window.electronAPI?.answerSheetBuilder
      if (!api) return

      try {
        await api.deleteDefinition(id)
        await loadDefinitions()
        toast.success("定義を削除しました")
      } catch (error) {
        toast.error("定義を削除できませんでした", {
          description: error instanceof Error ? error.message : undefined,
        })
      }
    },
    [loadDefinitions]
  )

  const duplicateDefinition = useCallback(
    async (id: string) => {
      if (!userId) return
      const api = window.electronAPI?.answerSheetBuilder
      if (!api) return

      try {
        await api.duplicateDefinition(id, userId)
        toast.success("定義を複製しました")
        await loadDefinitions()
      } catch (error) {
        toast.error("定義を複製できませんでした", {
          description: error instanceof Error ? error.message : undefined,
        })
      }
    },
    [userId, loadDefinitions]
  )

  return {
    definitions,
    isLoading,
    loadDefinitions,
    deleteDefinition,
    duplicateDefinition,
  }
}
