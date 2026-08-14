import type { Prisma } from "@prisma/client"
import { queryOptions } from "@tanstack/react-query"

import { defineMutation } from "./defineMutation"
import { scopeKeys } from "./keys"

/**
 * 採点領域（CropRegion）の読み書き。
 *
 * 対応する preload は `electron-src/preload-apis/cropRegionApi.ts`。
 */

// =====================================================================
// 取得
// =====================================================================

/** 採点領域1件（小計点の割り当てと採点結果を子として持つ） */
export type CropRegionRow = Awaited<
  ReturnType<typeof window.electronAPI.getCropRegionsByExamId>
>[number]

/** その試験の採点領域（小計欄も含む全部） */
export const cropRegionsQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "cropRegions"] as const,
    queryFn: () => window.electronAPI.getCropRegionsByExamId(examId),
  })

/** 設問の解答欄だけ（小計欄を除く） */
export const questionAnswerRegionsQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "questionAnswerRegions"] as const,
    queryFn: () => window.electronAPI.getQuestionAnswerRegionsByExamId(examId),
  })

// =====================================================================
// 書き込み
// =====================================================================

const examScope = (examId: string) => scopeKeys.exam(examId)

export const createCropRegionMutation = (examId: string) =>
  defineMutation({
    mutationFn: (data: Prisma.CropRegionUncheckedCreateInput) =>
      window.electronAPI.createCropRegion(data),
    scope: { id: `exam:${examId}:cropRegions` },
    meta: {
      invalidates: [examScope(examId)],
      errorMessage: "採点領域を作成できませんでした",
    },
  })

export const updateCropRegionMutation = (examId: string) =>
  defineMutation({
    mutationFn: (input: { id: string; data: Prisma.CropRegionUpdateInput }) =>
      window.electronAPI.updateCropRegion(input.id, input.data),
    scope: { id: `exam:${examId}:cropRegions` },
    meta: {
      invalidates: [examScope(examId)],
      errorMessage: "採点領域を保存できませんでした",
    },
  })

export const deleteCropRegionMutation = (examId: string) =>
  defineMutation({
    mutationFn: (cropRegionId: string) =>
      window.electronAPI.deleteCropRegion(cropRegionId),
    scope: { id: `exam:${examId}:cropRegions` },
    meta: {
      invalidates: [examScope(examId)],
      errorMessage: "採点領域を削除できませんでした",
    },
  })

export const updateCropRegionOrdersMutation = (examId: string) =>
  defineMutation({
    mutationFn: (updates: { id: string; orderIndex: number }[]) =>
      window.electronAPI.updateCropRegionOrders(updates),
    scope: { id: `exam:${examId}:cropRegions` },
    meta: {
      invalidates: [examScope(examId)],
      errorMessage: "採点領域の並び順を保存できませんでした",
    },
  })
