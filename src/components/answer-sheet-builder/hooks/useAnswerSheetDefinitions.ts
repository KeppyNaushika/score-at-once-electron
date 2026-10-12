"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useCallback } from "react"
import { toast } from "sonner"

import {
  answerSheetDefinitionListQuery,
  deleteAnswerSheetDefinitionMutation,
  duplicateAnswerSheetDefinitionMutation,
} from "@/queries/answerSheetBuilder"
import type { ASBDefinitionListItem } from "@/types/answerSheetBuilder.types"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_DEFINITIONS: ASBDefinitionListItem[] = []

/**
 * 解答用紙一覧のCRUDフック。
 *
 * 一覧には誰の解答用紙も出る。編集・削除ができるのは担当者だけで、
 * それ以外の利用者は閲覧と書き出しだけができる。
 *
 * 失敗の通知と一覧の取り直しは書き込みの宣言（`meta`）が持つので、ここには無い。
 */
export function useAnswerSheetDefinitions(userId: string) {
  const { data: definitions = EMPTY_DEFINITIONS, isPending: isLoading } =
    useQuery(answerSheetDefinitionListQuery())

  const { mutateAsync: removeDefinition } = useMutation(
    deleteAnswerSheetDefinitionMutation()
  )
  const { mutateAsync: copyDefinition } = useMutation(
    duplicateAnswerSheetDefinitionMutation()
  )

  /**
   * 消す。失敗は投げる（確認窓を開いたままにするかを呼び手が決めるため）。
   * 成功の知らせも、何を消したかを知っている呼び手が出す
   */
  const deleteDefinition = useCallback(
    (definitionId: string) => removeDefinition({ definitionId, userId }),
    [userId, removeDefinition]
  )

  const duplicateDefinition = useCallback(
    async (definitionId: string) => {
      try {
        await copyDefinition({ definitionId, userId })
        toast.success("解答用紙を複製しました")
      } catch {
        // 失敗の通知は MutationCache が出す
      }
    },
    [userId, copyDefinition]
  )

  return {
    definitions,
    isLoading,
    deleteDefinition,
    duplicateDefinition,
  }
}
