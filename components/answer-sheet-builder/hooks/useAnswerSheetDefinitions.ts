"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import type { ASBDefinitionListItem } from "@/types/answerSheetBuilder.types"
import type { AnswerSheetDefinition } from "@/types/answerSheetDefinition.types"

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

      const original: AnswerSheetDefinition = loadResult.data
      const newId = crypto.randomUUID()

      // 全子要素のIDを再生成して一意性を保つ
      const regeneratedHeaderFields = original.settings.headerFields.map(
        (hf) => ({ ...hf, id: crypto.randomUUID() })
      )
      const regeneratedMajorQuestions = original.majorQuestions.map((mq) => ({
        ...mq,
        id: crypto.randomUUID(),
        subQuestions: mq.subQuestions.map((sq) => ({
          ...sq,
          id: crypto.randomUUID(),
          textElements: sq.textElements.map((te) => ({
            ...te,
            id: crypto.randomUUID(),
          })),
          imageElements: sq.imageElements?.map((ie) => ({
            ...ie,
            id: crypto.randomUUID(),
          })),
          branchQuestions: sq.branchQuestions.map((bq) => ({
            ...bq,
            id: crypto.randomUUID(),
            textElements: bq.textElements.map((te) => ({
              ...te,
              id: crypto.randomUUID(),
            })),
            imageElements: bq.imageElements?.map((ie) => ({
              ...ie,
              id: crypto.randomUUID(),
            })),
          })),
        })),
      }))

      const duplicated = {
        ...original,
        id: newId,
        name: `${original.name} (コピー)`,
        settings: {
          ...original.settings,
          headerFields: regeneratedHeaderFields,
        },
        majorQuestions: regeneratedMajorQuestions,
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
