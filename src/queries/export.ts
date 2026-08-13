import { queryOptions } from "@tanstack/react-query"

import { defineMutation } from "./defineMutation"
import { scopeKeys } from "./keys"

/**
 * 出力（Excel・PDF・印刷）の読み書き。
 *
 * ほとんどが DB を書かない経路である。読み直す対象を持たないので `meta` は
 * `writesDatabase: false` を名乗る。
 *
 * 対応する preload は `electron-src/preload-apis/exportApi.ts`。
 */

// =====================================================================
// 取得
// =====================================================================

/** 個人成績表に出せる小計点グループ */
export const subtotalGroupsForReportQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "subtotalGroupsForReport"] as const,
    queryFn: () => window.electronAPI.export.getSubtotalGroupsForReport(examId),
  })

/** 返却済みの版との差分 */
export const returnDiffQuery = (examId: string) =>
  queryOptions({
    queryKey: [...scopeKeys.exam(examId), "returnDiff"] as const,
    queryFn: () => window.electronAPI.export.getReturnDiff(examId),
  })

// =====================================================================
// DB を書かない操作
// =====================================================================

/** 印刷ダイアログを開く。ブラウザの印刷と同じで、DB は変わらない */
export const openPrintDialogMutation = () =>
  defineMutation({
    mutationFn: (input: { html: string; title: string }) =>
      window.electronAPI.export.openPrintDialog(input),
    meta: {
      writesDatabase: false,
      errorMessage: "印刷できませんでした",
    },
  })

/** 出力前の突き合わせ。読むだけで DB は変わらない */
export const validateScoringDataMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<typeof window.electronAPI.export.validateScoringData>[0]
    ) => window.electronAPI.export.validateScoringData(input),
    meta: {
      writesDatabase: false,
      errorMessage: "採点データを確認できませんでした",
    },
  })

/** 未解決の競合を承知のうえで出力したことを監査ログへ残す */
export const recordUnresolvedConflictsMutation = () =>
  defineMutation({
    mutationFn: (
      input: Parameters<
        typeof window.electronAPI.export.recordUnresolvedConflicts
      >[0]
    ) => window.electronAPI.export.recordUnresolvedConflicts(input),
    meta: {
      writesDatabase: false,
      errorMessage: "競合の記録を残せませんでした",
    },
  })

/** 返却した時点の姿を記録する */
export const captureReturnSnapshotMutation = (examId: string) =>
  defineMutation({
    mutationFn: (
      input: Parameters<
        typeof window.electronAPI.export.captureReturnSnapshot
      >[0]
    ) => window.electronAPI.export.captureReturnSnapshot(input),
    meta: {
      invalidates: [returnDiffQuery(examId).queryKey],
      errorMessage: "返却時点を記録できませんでした",
    },
  })
