"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useCallback, useMemo } from "react"

import {
  deleteOmrConfigMutation,
  omrConfigsQuery,
  upsertOmrConfigMutation,
} from "@/queries/omr"

/**
 * 試験に紐づくOMR設定を扱うフック。
 *
 * 設定は採点領域idで引くので、表示のたびにマップへ畳む（DB から返るのは行の並び）。
 */
export function useOmrConfig(examId: string) {
  const { data: omrConfigRows } = useQuery(omrConfigsQuery(examId))
  const upsertOmrConfigMutate = useMutation(upsertOmrConfigMutation(examId))
  const deleteOmrConfigMutate = useMutation(deleteOmrConfigMutation(examId))

  const omrConfigByCropRegionId = useMemo(
    () =>
      new Map(
        (omrConfigRows ?? []).map((omrConfig) => [
          omrConfig.cropRegionId,
          omrConfig,
        ])
      ),
    [omrConfigRows]
  )

  /** OMR設定をupsert。書けたかどうかを返す（呼び出し側がダイアログを閉じる判断に使う） */
  const upsertOmrConfig = useCallback(
    async (
      input: Parameters<typeof upsertOmrConfigMutate.mutateAsync>[0]
    ): Promise<boolean> => {
      try {
        await upsertOmrConfigMutate.mutateAsync(input)
        return true
      } catch {
        // 失敗の知らせは中央のトーストが出す
        return false
      }
    },
    [upsertOmrConfigMutate]
  )

  const deleteOmrConfig = useCallback(
    async (cropRegionId: string): Promise<boolean> => {
      try {
        await deleteOmrConfigMutate.mutateAsync(cropRegionId)
        return true
      } catch {
        return false
      }
    },
    [deleteOmrConfigMutate]
  )

  const getOmrConfig = useCallback(
    (cropRegionId: string) => omrConfigByCropRegionId.get(cropRegionId) ?? null,
    [omrConfigByCropRegionId]
  )

  return {
    getOmrConfig,
    upsertOmrConfig,
    deleteOmrConfig,
  }
}
