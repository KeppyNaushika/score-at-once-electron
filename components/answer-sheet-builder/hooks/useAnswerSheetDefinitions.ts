"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import type { ASBDefinitionListItem } from "@/types/answerSheetBuilder.types"

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
      setDefinitions((prev) => prev.filter((d) => d.id !== id))
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

      const loadResult = await api.loadDefinition(id)
      if (!loadResult.success || !loadResult.data) {
        toast.error("定義の読み込みに失敗しました")
        return
      }

      const original = loadResult.data
      const newId = crypto.randomUUID()
      const duplicated = {
        ...original,
        id: newId,
        name: `${original.name} (コピー)`,
        createdAt: undefined,
        updatedAt: undefined,
      }

      const saveResult = await api.saveDefinition(duplicated, userId)
      if (saveResult.success) {
        toast.success("定義を複製しました")
        await loadDefinitions()
      } else {
        toast.error(saveResult.error ?? "複製に失敗しました")
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
