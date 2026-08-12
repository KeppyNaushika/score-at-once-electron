"use client"

import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"

import { queryKeys } from "@/lib/queryKeys"
import type { CropRegionOmrConfigWithOptions } from "@/types/omr.types"

/** 未取得のときに毎回新しい Map を作らないための空値 */
const EMPTY_CONFIGS: ReadonlyMap<string, CropRegionOmrConfigWithOptions> =
  new Map()

/**
 * 試験に紐づくOMR設定をCRUD管理するフック
 */
export function useOmrConfig(examId: string) {
  const queryClient = useQueryClient()
  const queryKey = queryKeys.exam.omrConfigs(examId)
  // 設定は採点領域idで引くので、取得直後にマップへ畳んでおく
  const { data: omrConfigs = EMPTY_CONFIGS } = useQuery({
    queryKey,
    queryFn: examId
      ? async () =>
          new Map(
            (await window.electronAPI.omrConfig.getByExam(examId)).map(
              (config) => [config.cropRegionId, config]
            )
          )
      : skipToken,
  })

  /** 1件分の設定をキャッシュへ差し込む（保存の往復を待たせない） */
  const patchCache = useCallback(
    (cropRegionId: string, config: CropRegionOmrConfigWithOptions | null) => {
      queryClient.setQueryData<Map<string, CropRegionOmrConfigWithOptions>>(
        queryKey,
        (previous) => {
          const next = new Map(previous ?? [])
          if (config) next.set(cropRegionId, config)
          else next.delete(cropRegionId)
          return next
        }
      )
    },
    [queryClient, queryKey]
  )

  /** OMR設定をupsert */
  const upsertOmrConfig = useCallback(
    async (data: {
      cropRegionId: string
      type: "choice"
      numChoices?: number | null
      choiceLayout?: string | null
      choiceOptions?: Array<{
        choiceIndex: number
        label: string
        isCorrect: boolean
      }>
    }) => {
      try {
        patchCache(
          data.cropRegionId,
          await window.electronAPI.omrConfig.upsert(data)
        )
        return true
      } catch (error) {
        console.error("Failed to upsert OMR config:", error)
        return false
      }
    },
    [patchCache]
  )

  /** OMR設定を削除 */
  const deleteOmrConfig = useCallback(
    async (cropRegionId: string) => {
      try {
        await window.electronAPI.omrConfig.delete(cropRegionId)
        patchCache(cropRegionId, null)
        return true
      } catch (error) {
        console.error("Failed to delete OMR config:", error)
        return false
      }
    },
    [patchCache]
  )

  /** CropRegionIDでOMR設定を取得 */
  const getOmrConfig = useCallback(
    (cropRegionId: string) => omrConfigs.get(cropRegionId) ?? null,
    [omrConfigs]
  )

  return {
    getOmrConfig,
    upsertOmrConfig,
    deleteOmrConfig,
  }
}
