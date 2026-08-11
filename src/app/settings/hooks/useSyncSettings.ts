"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type {
  SyncAppConfig,
  SyncAppStatus,
} from "@/electron-src/lib/sync/types"

const DEFAULT_STATUS: SyncAppStatus = {
  state: "disabled",
  lastSyncTime: null,
  lastError: null,
  syncCount: 0,
  versionMismatches: [],
}

export function useSyncSettings() {
  const [config, setConfig] = useState<SyncAppConfig | null>(null)
  const [syncPath, setSyncPath] = useState<string>("")
  const [status, setStatus] = useState<SyncAppStatus>(DEFAULT_STATUS)
  const [isLoading, setIsLoading] = useState(true)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [{ config, syncPath }, syncStatus] = await Promise.all([
          window.electronAPI.sync.getConfig(),
          window.electronAPI.sync.getStatus(),
        ])
        if (config) setConfig(config)
        setSyncPath(syncPath)
        setStatus(syncStatus)
      } catch (error) {
        console.error("Failed to load sync settings:", error)
      } finally {
        setIsLoading(false)
      }
    }
    void load()

    cleanupRef.current = window.electronAPI.sync.onStatusChanged(
      (newStatus) => {
        setStatus(newStatus)
      }
    )

    return () => {
      cleanupRef.current?.()
    }
  }, [])

  const updateConfig = useCallback(async (partial: Partial<SyncAppConfig>) => {
    await window.electronAPI.sync.setConfig(partial)
    setConfig((prev) => (prev ? { ...prev, ...partial } : prev))
    setStatus(await window.electronAPI.sync.getStatus())
  }, [])

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
