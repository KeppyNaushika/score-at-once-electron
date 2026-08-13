"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useState } from "react"

import type {
  SyncAppConfig,
  SyncAppStatus,
} from "@/electron-src/lib/sync/types"
import { queryKeys } from "@/lib/queryKeys"

const DEFAULT_STATUS: SyncAppStatus = {
  state: "disabled",
  lastSyncTime: null,
  lastError: null,
  syncCount: 0,
  versionMismatches: [],
}

export function useSyncSettings() {
  const queryClient = useQueryClient()
  const queryKey = queryKeys.settings.sync

  // 設定・保存先・状態は必ず対で表示するので1つの取得にまとめる
  const { data, isPending: isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const [{ config, syncPath }, status] = await Promise.all([
        window.electronAPI.sync.getConfig(),
        window.electronAPI.sync.getStatus(),
      ])
      return { config, syncPath, status }
    },
  })
  const config = data?.config ?? null
  const syncPath = data?.syncPath ?? ""

  /**
   * 状態は main から押し出されてくる（同期の進行はこちらから聞きに行くものではない）。
   * 購読で受けた分はキャッシュへ差し込む。
   */
  const [pushedStatus, setPushedStatus] = useState<SyncAppStatus | null>(null)
  useEffect(() => {
    return window.electronAPI.sync.onStatusChanged(setPushedStatus)
  }, [])
  const status = pushedStatus ?? data?.status ?? DEFAULT_STATUS

  const updateConfig = useCallback(
    async (partial: Partial<SyncAppConfig>) => {
      await window.electronAPI.sync.setConfig(partial)
      setPushedStatus(null)
      await queryClient.invalidateQueries({ queryKey })
    },
    [queryClient, queryKey]
  )

  const triggerSync = useCallback(async () => {
    return window.electronAPI.sync.triggerNow()
  }, [])

  return {
    config,
    syncPath,
    status,
    isLoading,
    updateConfig,
    triggerSync,
  }
}
