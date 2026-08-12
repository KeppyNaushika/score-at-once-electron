"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { toast } from "sonner"

import { queryKeys } from "@/lib/queryKeys"
import type { ASBDefinitionListItem } from "@/types/answerSheetBuilder.types"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_DEFINITIONS: ASBDefinitionListItem[] = []

/**
 * 解答用紙一覧のCRUDフック。
 *
 * 一覧には誰の解答用紙も出る。編集・削除ができるのは担当者だけで、
 * それ以外の利用者は閲覧と書き出しだけができる。
 */
export function useAnswerSheetDefinitions(userId: string | undefined) {
  const queryClient = useQueryClient()
  const queryKey = queryKeys.answerSheetDefinition.list()
  const { data: definitions = EMPTY_DEFINITIONS, isPending: isLoading } =
    useQuery({
      queryKey,
      queryFn: () => window.electronAPI.answerSheetBuilder.listDefinitions(),
    })

  const loadDefinitions = useCallback(
    () => queryClient.invalidateQueries({ queryKey }),
    [queryClient, queryKey]
  )

  const deleteDefinition = useCallback(
    async (id: string) => {
      if (!userId) return
      try {
        await window.electronAPI.answerSheetBuilder.deleteDefinition(id, userId)
        await loadDefinitions()
        toast.success("解答用紙を削除しました")
      } catch (error) {
        toast.error("解答用紙を削除できませんでした", {
          description: error instanceof Error ? error.message : undefined,
        })
      }
    },
    [userId, loadDefinitions]
  )

  const duplicateDefinition = useCallback(
    async (id: string) => {
      if (!userId) return
      try {
        await window.electronAPI.answerSheetBuilder.duplicateDefinition(
          id,
          userId
        )
        toast.success("解答用紙を複製しました")
        await loadDefinitions()
      } catch (error) {
        toast.error("解答用紙を複製できませんでした", {
          description: error instanceof Error ? error.message : undefined,
        })
      }
    },
    [userId, loadDefinitions]
  )

  /** 担当を別の利用者へ渡す（渡せるのは今の担当者だけ） */
  const transferOwner = useCallback(
    async (id: string, nextUserId: string) => {
      if (!userId) return
      try {
        await window.electronAPI.answerSheetBuilder.transferOwner(
          id,
          userId,
          nextUserId
        )
        await loadDefinitions()
        toast.success("担当を渡しました")
      } catch (error) {
        toast.error("担当を渡せませんでした", {
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
    transferOwner,
  }
}
