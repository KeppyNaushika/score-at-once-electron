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
      const result = await api.listDefinitions(userId)
      if (result.success && result.data) {
        setDefinitions(result.data)
      } else {
        toast.error(result.error ?? "定義一覧の取得に失敗しました")
      }
    } catch {
      toast.error("定義一覧の取得に失敗しました")
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

    const result = await api.deleteDefinition(id)
    if (result.success) {
      setDefinitions((prev) =>
        prev.filter((definition) => definition.id !== id)
      )
      toast.success("定義を削除しました")
    } else {
      toast.error(result.error ?? "削除に失敗しました")
    }
  }, [])

  const duplicateDefinition = useCallback(
    async (id: string) => {
      if (!userId) return
      const api = window.electronAPI?.answerSheetBuilder
      if (!api) return

      const result = await api.duplicateDefinition(id, userId)
      if (result.success) {
        toast.success("定義を複製しました")
        await loadDefinitions()
      } else {
        toast.error(result.error ?? "複製に失敗しました")
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
