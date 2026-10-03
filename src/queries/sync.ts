import { queryOptions } from "@tanstack/react-query"

import type { SyncAppConfig } from "@/electron-src/lib/sync/types"

import { defineMutation } from "./defineMutation"

/**
 * NAS同期の設定と状態。
 *
 * 対応する preload は `electron-src/preload-apis/syncApi.ts`。
 * 状態の押し出し（`onStatusChanged`）は購読なので取得の形にはならない。
 */

// =====================================================================
// 取得
// =====================================================================

/** 同期の設定と保存先 */
export const syncConfigQuery = () =>
  queryOptions({
    queryKey: ["sync", "config"] as const,
    queryFn: () => window.electronAPI.sync.getConfig(),
  })

/** 同期の現在の状態（この後は main から押し出されてくる） */
export const syncStatusQuery = () =>
  queryOptions({
    queryKey: ["sync", "status"] as const,
    queryFn: () => window.electronAPI.sync.getStatus(),
  })

/** main が状態を押し出してきたら呼ばれる購読を張る。外すのは戻り値を呼ぶ */
export const subscribeSyncStatus = (
  onChanged: Parameters<typeof window.electronAPI.sync.onStatusChanged>[0]
) => window.electronAPI.sync.onStatusChanged(onChanged)

/**
 * 同期で、別id・同一ユニークキーでかぶった行の片方が隠れたり、隠れていた行が
 * 表示に戻ったりしたら呼ばれる購読を張る。
 *
 * どちらも画面の上では黙って行が消えた・現れたように見えるので、起きた瞬間に
 * 押し出される（既読は持たない）。外すのは戻り値を呼ぶ。
 */
export const subscribeSyncRecordFoldsChanged = (
  onChanged: Parameters<typeof window.electronAPI.sync.onRecordFoldsChanged>[0]
) => window.electronAPI.sync.onRecordFoldsChanged(onChanged)

/**
 * 親の行が他のPCで削除されたために表から外れた行、親が作り直されて戻った行が
 * 出たら呼ばれる購読を張る。
 *
 * こちらも画面の上では黙って行が消えた・現れたように見えるので、起きた瞬間に
 * 押し出される（既読は持たない）。外すのは戻り値を呼ぶ。
 */
export const subscribeSyncParentDeletedChanged = (
  onChanged: Parameters<
    typeof window.electronAPI.sync.onParentDeletedChanged
  >[0]
) => window.electronAPI.sync.onParentDeletedChanged(onChanged)

// =====================================================================
// 書き込み
// =====================================================================

export const setSyncConfigMutation = () =>
  defineMutation({
    mutationFn: (partial: Partial<SyncAppConfig>) =>
      window.electronAPI.sync.setConfig(partial),
    meta: {
      invalidates: [syncConfigQuery().queryKey, syncStatusQuery().queryKey],
      errorMessage: "同期の設定を保存できませんでした",
    },
  })

/** 今すぐ同期する。DB は同期が書き換えるので、その後の取り直しは呼び出し側に委ねる */
export const triggerSyncMutation = () =>
  defineMutation({
    mutationFn: () => window.electronAPI.sync.triggerNow(),
    meta: {
      invalidates: [syncStatusQuery().queryKey],
      errorMessage: "同期を実行できませんでした",
    },
  })
