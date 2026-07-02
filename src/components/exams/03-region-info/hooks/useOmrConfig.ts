"use client"

import { useCallback, useEffect, useState } from "react"

import type { CropRegionOmrConfigWithOptions } from "@/types/omr.types"

/**
 * 試験に紐づくOMR設定をCRUD管理するフック
 */
export function useOmrConfig(examId: string) {
  const [omrConfigs, setOmrConfigs] = useState<
    Map<string, CropRegionOmrConfigWithOptions>
  >(new Map())
  /** OMR設定をDBから読み込み */
  const loadOmrConfigs = useCallback(async () => {
    if (!examId) return
    try {
      const result = await window.electronAPI.omrConfig.getByExam(examId)
      if (result.success && result.configs) {
        const map = new Map<string, CropRegionOmrConfigWithOptions>()
        for (const config of result.configs) {
          map.set(config.cropRegionId, config)
        }
        setOmrConfigs(map)
      }
    } catch (error) {
      console.error("Failed to load OMR configs:", error)
    }
  }, [examId])

  useEffect(() => {
    loadOmrConfigs()
  }, [loadOmrConfigs])

  /** OMR設定をupsert */
  const upsertOmrConfig = useCallback(
    async (data: {
      cropRegionId: string
      type: "choice" | "handwritten-digit"
      numChoices?: number | null
      choiceLayout?: string | null
      numDigits?: number | null
      correctAnswer?: string | null
      choiceOptions?: Array<{
        choiceIndex: number
        label: string
        isCorrect: boolean
      }>
    }) => {
      try {
        const result = await window.electronAPI.omrConfig.upsert(data)
        if (result.success && result.config) {
          setOmrConfigs((prev) => {
            const next = new Map(prev)
            next.set(data.cropRegionId, result.config!)
            return next
          })
          return true
        }
        return false
      } catch (error) {
        console.error("Failed to upsert OMR config:", error)
        return false
      }
    },
    []
  )

  /** OMR設定を削除 */
  const deleteOmrConfig = useCallback(async (cropRegionId: string) => {
    try {
      const result = await window.electronAPI.omrConfig.delete(cropRegionId)
      if (result.success) {
        setOmrConfigs((prev) => {
          const next = new Map(prev)
          next.delete(cropRegionId)
          return next
        })
        return true
      }
      return false
    } catch (error) {
      console.error("Failed to delete OMR config:", error)
      return false
    }
  }, [])

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
