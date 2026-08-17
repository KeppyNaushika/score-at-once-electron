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

/**
 * 模範解答のマスターマーカー検出結果。
 *
 * 補正できるページかどうかの判定に使う。読むだけで DB は変わらない。
 */
export const masterMarkersQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "masterMarkers"] as const,
    queryFn: () => window.electronAPI.omr.detectMasterMarkers(examId),
  })

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

// =====================================================================
// フックの外から呼ぶもの
// =====================================================================

/**
 * 認識のパイプライン（設定 → マーカー → 一括認識）は1つの操作が数段に跨がる。
 * どれも DB を書かないので取り直す先が無く、`pdfTools.ts` と同じくそのまま
 * 関数として出す。
 */

/** 模範解答のマーカーをその場で検出する（認識の前段） */
export const detectMasterMarkers = (examId: string) =>
  window.electronAPI.omr.detectMasterMarkers(examId)

/** 答案をまとめて認識する */
export const batchRecognizeOmr = (
  input: Parameters<typeof window.electronAPI.omr.batchRecognize>[0]
) => window.electronAPI.omr.batchRecognize(input)

/**
 * 一括認識の進捗を購読する。
 *
 * 取得でも書き込みでもない（main から押し出される通知）ので、キャッシュには
 * 載せない。戻り値は購読を解く関数。
 */
export const subscribeOmrBatchProgress = (
  onProgress: Parameters<typeof window.electronAPI.omr.onBatchProgress>[0]
) => window.electronAPI.omr.onBatchProgress(onProgress)

/** 答案画像をマーカー基準で補正する。画像を返すだけで DB は変わらない */
export const correctImageMutation = () =>
  defineMutation({
    mutationFn: (input: {
      examPageId: string
      buffer: Uint8Array
      colorThreshold?: number
    }) =>
      window.electronAPI.omr.correctImage(
        input.examPageId,
        input.buffer,
        input.colorThreshold
      ),
    meta: {
      writesDatabase: false,
      errorMessage: "答案画像を補正できませんでした",
    },
  })
