"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import type {
  SyncAppConfig,
  SyncAppStatus,
} from "@/electron-src/lib/sync/types"
import {
  setSyncConfigMutation,
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
}

export function useSyncSettings() {
  // 設定と保存先、そして今の状態。どちらも同期の1つの姿として並べて出す
  const { data: syncConfig, isPending: configPending } =
    useQuery(syncConfigQuery())
  const { data: fetchedStatus, isPending: statusPending } =
    useQuery(syncStatusQuery())
  const setSyncConfig = useMutation(setSyncConfigMutation())
  const triggerSync = useMutation(triggerSyncMutation())

  /**
   * 状態は main から押し出されてくる（同期の進行はこちらから聞きに行くものではない）。
   * 購読で受けた分は、取得した分より新しい。
   */
  const [pushedStatus, setPushedStatus] = useState<SyncAppStatus | null>(null)
  useEffect(() => subscribeSyncStatus(setPushedStatus), [])

  /**
   * 設定を書く。**失敗を呼び出し側へ渡すため `mutateAsync` を返す。**
   * `mutate` だと `undefined` を返すので、`await` しても失敗を受け取れず、
   * 書けなかった設定を「変えました」と知らせることになる。
   */
  const updateConfig = (partial: Partial<SyncAppConfig>) =>
    setSyncConfig.mutateAsync(partial, {
      // 設定を変えると状態も取り直すので、押し出された分は捨てる
      onSuccess: () => setPushedStatus(null),
    })

  return {
    config: syncConfig?.config ?? null,
    syncPath: syncConfig?.syncPath ?? "",
    status: pushedStatus ?? fetchedStatus ?? DEFAULT_STATUS,
    isLoading: configPending || statusPending,
    updateConfig,
    triggerSync: () => triggerSync.mutateAsync(),
  }
}
