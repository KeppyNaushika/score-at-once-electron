"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { SyncAppConfig, SyncAppStatus } from "@/types/electron/syncApi"

const DEFAULT_STATUS: SyncAppStatus = {
  state: "disabled",
  lastSyncTime: null,
  lastError: null,
  syncCount: 0,
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
        const [configResult, statusResult] = await Promise.all([
          window.electronAPI.sync.getConfig(),
          window.electronAPI.sync.getStatus(),
        ])
        if (configResult.success && configResult.config) {
          setConfig(configResult.config)
        }
        if (configResult.success && configResult.syncPath) {
          setSyncPath(configResult.syncPath)
        }
        if (statusResult.success && statusResult.status) {
          setStatus(statusResult.status)
        }
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
    const result = await window.electronAPI.sync.setConfig(partial)
    if (result.success) {
      setConfig((prev) => (prev ? { ...prev, ...partial } : prev))
      const statusResult = await window.electronAPI.sync.getStatus()
      if (statusResult.success && statusResult.status) {
        setStatus(statusResult.status)
      }
    }
    return result
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
