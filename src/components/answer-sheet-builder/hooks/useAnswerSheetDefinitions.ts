"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import type { ASBDefinitionListItem } from "@/types/answerSheetBuilder.types"

/**
 * 解答用紙定義一覧のCRUDフック。
 * IPC経由でメインプロセスの定義リストを取得・操作する。
 */
export function useAnswerSheetDefinitions(userId: string | undefined) {
  const [definitions, setDefinitions] = useState<ASBDefinitionListItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadDefinitions = useCallback(async () => {
    if (!userId) return
    const api = window.electronAPI?.answerSheetBuilder
    if (!api) return

    setIsLoading(true)
    try {
      setDefinitions(await api.listDefinitions(userId))
    } catch (error) {
      toast.error("定義一覧を取得できませんでした", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadDefinitions()
  }, [loadDefinitions])

  const deleteDefinition = useCallback(async (id: string) => {
    const api = window.electronAPI?.answerSheetBuilder
    if (!api) return

    try {
      await api.deleteDefinition(id)
      setDefinitions((prev) =>
        prev.filter((definition) => definition.id !== id)
      )
      toast.success("定義を削除しました")
    } catch (error) {
      toast.error("定義を削除できませんでした", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }, [])

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
