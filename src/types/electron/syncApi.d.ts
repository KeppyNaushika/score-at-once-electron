/**
 * NAS同期 API 型定義
 */

export interface SyncAppConfig {
  enabled: boolean
  clientId: string
  intervalMs: number
  changelogRetentionDays: number
}

export interface SyncAppStatus {
  state: "idle" | "syncing" | "error" | "disabled"
  lastSyncTime: string | null
  lastError: string | null
  syncCount: number
}

export interface SyncAPI {
  sync: {
    getConfig(): Promise<{
      success: boolean
      config?: SyncAppConfig
      syncPath?: string
      error?: string
    }>
    setConfig(
      config: Partial<SyncAppConfig>
    ): Promise<{ success: boolean; error?: string }>
    triggerNow(): Promise<{ success: boolean; error?: string }>
    getStatus(): Promise<{
      success: boolean
      status?: SyncAppStatus
      error?: string
    }>
    onStatusChanged(callback: (status: SyncAppStatus) => void): () => void
  }
}
