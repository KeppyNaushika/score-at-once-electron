import { queryOptions } from "@tanstack/react-query"

import { defineMutation } from "./defineMutation"
import { scopeKeys } from "./keys"

/**
 * OMR（光学マーク認識）の設定と認識。
 *
 * 対応する preload は `electron-src/preload-apis/omrApi.ts`。
 */

// =====================================================================
// 取得
// =====================================================================

/** その試験の採点領域に付いている OMR 設定 */
export const omrConfigsQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "omrConfigs"] as const,
    queryFn: () => window.electronAPI.omrConfig.getByExam(examId),
  })

// =====================================================================
// 書き込み
// =====================================================================

export const upsertOmrConfigMutation = (examId: string) =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.omrConfig.upsert>[0]
    ) => window.electronAPI.omrConfig.upsert(input),
    scope: { id: `exam:${examId}:omrConfigs` },
    meta: {
      invalidates: [omrConfigsQuery(examId).queryKey],
      errorMessage: "OMR設定を保存できませんでした",
    },
  })

export const deleteOmrConfigMutation = (examId: string) =>
  defineMutation({
    mutationFn: (cropRegionId: string) =>
      window.electronAPI.omrConfig.delete(cropRegionId),
    scope: { id: `exam:${examId}:omrConfigs` },
    meta: {
      invalidates: [omrConfigsQuery(examId).queryKey],
      errorMessage: "OMR設定を削除できませんでした",
    },
  })
