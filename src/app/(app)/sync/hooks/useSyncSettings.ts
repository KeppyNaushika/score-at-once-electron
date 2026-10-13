"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import type { SyncAppStatus } from "@/electron-src/lib/sync/types"
import {
  chooseSharedFolder,
  connectSharedFolderMutation,
  inspectSharedFolder,
  migrateProfileToLocalMutation,
  relaunchApp,
  selectStartupStorageMutation,
  setSyncTimingMutation,
  subscribeSyncStatus,
  syncConfigQuery,
  syncStatusQuery,
  triggerSyncMutation,
} from "@/queries/sync"

const DEFAULT_STATUS: SyncAppStatus = {
  state: "disabled",
  lastSyncTime: null,
  lastError: null,
  syncCount: 0,
  versionMismatches: [],
  lastWarnings: [],
}

export function useSyncSettings() {
  // 設定と、いま動いている根。そして同期の今の状態
  const { data: overview, isPending: configPending } =
    useQuery(syncConfigQuery())
  const { data: fetchedStatus, isPending: statusPending } =
    useQuery(syncStatusQuery())
  const setSyncTiming = useMutation(setSyncTimingMutation())
  const triggerSync = useMutation(triggerSyncMutation())
  const connectSharedFolder = useMutation(connectSharedFolderMutation())
  const selectStartupStorage = useMutation(selectStartupStorageMutation())
  const migrateProfileToLocal = useMutation(migrateProfileToLocalMutation())

  /**
   * 状態は main から押し出されてくる（同期の進行はこちらから聞きに行くものではない）。
   * 購読で受けた分は、取得した分より新しい。
   */
  const [pushedStatus, setPushedStatus] = useState<SyncAppStatus | null>(null)
  useEffect(() => subscribeSyncStatus(setPushedStatus), [])

  const config = overview?.config ?? null
  const running = overview?.running ?? null

  /**
   * 次の起動の設定が、いま動いている根と違うか（＝再起動すると切り替わる）。
   * 根は起動時に1度だけ決まるので、設定を変えただけでは効かない。
   */
  const restartPending =
    config !== null &&
    running !== null &&
    (config.mode !== running.mode ||
      (config.mode === "shared" &&
        config.activeSharedFolderId !==
          (running.sharedFolder?.sharedFolderId ?? null)))

  return {
    config,
    running,
    restartPending,
    status: pushedStatus ?? fetchedStatus ?? DEFAULT_STATUS,
    isLoading: configPending || statusPending,
    /**
     * 書き込みは**失敗を呼び出し側へ渡すため `mutateAsync` を返す。**
     * `mutate` だと `await` しても失敗を受け取れず、できなかったことを「しました」と
     * 知らせることになる。
     */
    updateTiming: (intervalMs: number) =>
      setSyncTiming.mutateAsync(
        { intervalMs },
        { onSuccess: () => setPushedStatus(null) }
      ),
    triggerSync: () => triggerSync.mutateAsync(),
    connectSharedFolder: connectSharedFolder.mutateAsync,
    isConnecting: connectSharedFolder.isPending,
    selectStartupStorage: selectStartupStorage.mutateAsync,
    migrateProfileToLocal: migrateProfileToLocal.mutateAsync,
    isMigratingToLocal: migrateProfileToLocal.isPending,
    chooseSharedFolder,
    inspectSharedFolder,
    relaunch: relaunchApp,
  }
}
